const ApplicationIDs = {
  BLOCK_UTM: 'blockutm',
  MACE_PROTECTION: 'maceprotection',
  DEBUG_MODE: 'debugmode',
  REMEMBER_ME: 'rememberme',
  LOGOUT_ON_CLOSE: 'logoutOnClose',
};


class Settings {
  constructor (app) {
    // Bindings
    this.init = this.init.bind(this);
    this.toggle = this.toggle.bind(this);
    this.hasItem = this.hasItem.bind(this);
    this.getItem = this.getItem.bind(this);
    this.setItem = this.setItem.bind(this);
    this.getAll = this.getAll.bind(this);

    // Init
    this._app = app;
  }

  /* ------------------------------------ */
  /*              Getters                 */
  /* ------------------------------------ */

  get _storage () { return this._app.util.storage; }
  get _regionList () { return this._app.util.regionList; }
  get _adapter () { return this._app.adapter; }
  get _proxy () { return this._app.proxy; }
  get _logger () { return this._app.logger; }
  get _chromeSettings () { return this._app.chromesettings; }

  /* ------------------------------------ */
  /*          Transformations             */
  /* ------------------------------------ */

  get _apiSettings () { return [...Object.values(this._chromeSettings)]; }
  get _allSettings () { return [...Settings._appDefaults, ...this._apiSettings]; }
  get _appIDs () { return Settings._appDefaults.map((setting) => setting.settingID); }
  get _apiIDs () { return this._apiSettings.map((setting) => setting.settingID); }
  get _allIDs () { return [...this._appIDs, ...this._apiIDs]; }

  /* ------------------------------------ */
  /*              Private                 */
  /* ------------------------------------ */

  _getApiSetting (settingID) {
    return this._apiSettings.find((setting) => setting.settingID === settingID);
  }

  _existsApplicationSetting (settingID) {
    return Boolean(Settings._appDefaults.find((setting) => setting.settingID === settingID));
  }

  _validID (settingID) {
    if (!this._allIDs.includes(settingID)) {
      console.error(debug(`invalid settingID: ${settingID}`));
      return false;
    }

    return true;
  }

  _toggleSetting (settingID) {
    const newValue = !this.getItem(settingID);
    this.setItem(settingID, newValue, true);

    return newValue;
  }

  /**
   * Toggle application setting (side effects handled here)
   *
   * @param {string} settingID id of setting
   *
   * @returns {boolean} new value of setting
   */
  _toggleApplicationSetting (settingID) {
    const newValue = this._toggleSetting(settingID);

    switch (settingID) {
      case ApplicationIDs.MACE_PROTECTION:
        if (this._proxy.enabled()) {
          // No bridged mode for enable
          this._proxy.enable(this._regionList.getSelectedRegion()).catch(console.error);
        }
        break;

      case ApplicationIDs.DEBUG_MODE:
        if (!newValue) {
          this._logger.removeEntries();
        }
        break;
    }
    return newValue;
  }

  /**
   * Toggle API Setting (side effects handled by setting)
   *
   * @async
   *
   * @param {ApiSetting} setting Api Setting to toggle
   *
   * @returns {Promise<boolean>} new value of setting;
   */
  async _toggleApiSetting (setting) {
    const toggle = setting.isApplied() ? setting.clearSetting : setting.applySetting;
    try {
      await toggle.call(setting);
    }
    catch (_) {
      console.error(debug(`failed to toggle setting: ${setting.settingID}`));
    }
    const newValue = setting.isApplied();
    // Call this in bridged mode, as toggle has bridged mode
    this.setItem(setting.settingID, newValue, true);

    return newValue;
  }


  /* ------------------------------------ */
  /*               Public                 */
  /* ------------------------------------ */

  /**
   * Initialize the setting values
   *
   * This does not need a bridged mode, as this should only be used on the background.
   * The foreground does not have access to localStorage and can't reliably set defaults
   *
   * @returns {void}
   */
  init () {
    this._allSettings.forEach((setting) => {
      if (!this.hasItem(setting.settingID)) {
        // We call this in bridged mode because we do not want it setting items on the background
        this.setItem(setting.settingID, setting.settingDefault, true);
      }
    });
  }

  /**
   * Toggle the specified setting
   *
   * @async
   *
   * @param {string} settingID ID for setting
   * @param {boolean} [bridged] If API is bridged
   *
   * @returns {Promise<boolean>} New value of setting
   *
   * @throws {Error} if settingID is not valid
   */
  async toggle (settingID, bridged) {
    if (!bridged) {
      this._adapter.sendMessage('util.settings.toggle', {settingID});
    }

    // Look for setting in application settings
    if (this._existsApplicationSetting(settingID)) {
      return this._toggleApplicationSetting(settingID);
    }

    const apiSetting = this._getApiSetting(settingID);
    if (apiSetting && (apiSetting.alwaysActive || this._proxy.enabled())) {
      return this._toggleApiSetting(apiSetting);
    }

    if (apiSetting) {
      return this._toggleSetting(settingID);
    }

    // No such setting
    throw new Error(`settings.js: no such setting: ${settingID}`);
  }

  /**
   * Determine whether the setting exists yet
   *
   * @param {string} settingID ID for setting
   *
   * @returns {boolean} whether setting exists in storage
   *
   * @throws {Error} if settingID is not valid
   */
  hasItem (settingID) {
    if (this._validID(settingID)) {
      return this._storage.hasItem(settingID);
    }
    else {
      throw new Error('settings.js: cannot perform hasItem with invalid settingID');
    }
  }

  /**
   * Get the specified setting value
   *
   * @param {string} settingID ID for setting
   *
   * @returns {boolean} value of setting
   *
   * @throws {Error} if settingID is not valid
   */
  getItem (settingID) {
    if (this._validID(settingID)) {
      return this._storage.getItem(`settings:${settingID}`) === 'true';
    }
    else {
      throw new Error('settings.js: cannot perform get without valid settingID');
    }
  }

  /**
   * Get all the available settings
   *
   * @returns {Setting[]} list of settings
   */
  getAll () {
    return this._allIDs.map((settingID) => {
      return {
        settingID,
        value: this.getItem(settingID),
      };
    });
  }

  /**
   * Set the value of specified setting
   *
   * @param {string} settingID ID of setting
   * @param {boolean} value new value for setting
   * @param {boolean} bridged True if called on background
   *
   * @throws {Error} if settingID is not valid
   *
   * @returns {void}
   */
  setItem (settingID, value, bridged) {
    if (this._validID(settingID)) {
      value = String(value) === 'true';
      if (value !== this.getItem(settingID)) {
        const key = `settings:${settingID}`;
        this._storage.setItem(key, value);
        if (!bridged) {
          this._adapter.sendMessage('updateSettings', {settingID, value});
        }
      }
    }
    else {
      throw new Error('cannot perform setItem with invalid settingID');
    }
  }

  /* ------------------------------------ */
  /*               Static                 */
  /* ------------------------------------ */

  /**
   * Default values for Application Settings
   *
   * Also used as list of acceptable application settingID's
   */
  static get _appDefaults () {
    return [
      {
        settingID: ApplicationIDs.BLOCK_UTM,
        settingDefault: true,
      },
      {
        settingID: ApplicationIDs.MACE_PROTECTION,
        settingDefault: true,
      },
      {
        settingID: ApplicationIDs.DEBUG_MODE,
        settingDefault: false,
      },
      {
        settingID: ApplicationIDs.REMEMBER_ME,
        settingDefault: true,
      },
      {
        settingID: ApplicationIDs.LOGOUT_ON_CLOSE,
        settingDefault: false,
      },
    ];
  }
}

export default Settings;
