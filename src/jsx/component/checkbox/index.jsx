import React from 'react';
import PropTypes from 'prop-types';

import ErrorBoundary from '../../hoc/errorboundary';

const buildClassName = (postfix, id, ...others) => {
  let classNames = [`checkbox-${postfix}`];
  if (id) {
    classNames = [...classNames, `${id}-${postfix}`];
  }
  classNames = [...classNames, ...others];

  return classNames.join(' ');
};

/**
 * Presentational checkbox
 *
 * Used to enforce one, accessible style application wide.
 *
 * Use of styled label overtop of <input type="checkbox" />
 * is to prevent styling of native checkbox by GTK theme on
 * Firefox (Linux). Without this, using some GTK themes cause
 * varying appearances for checkboxes, even to the point of
 * them not being visible at all.
 *
 * @param {*} props React props
 *
 * @returns {JSX.Element} Component
 */
const Checkbox = (props) => {
  const {
    id,
    className,
    onChange,
    checked,
    disabled,
  } = props;

  return (
    <div className={buildClassName('container', id, className)}>
      <input
        checked={checked}
        id={id}
        name={id}
        onChange={onChange}
        className={buildClassName('input', id)}
        type="checkbox"
        disabled={disabled}
      />
      <label
        htmlFor={id}
        className={buildClassName('label', id)}
      />
    </div>
  );
};

Checkbox.propTypes = {
  id: PropTypes.string.isRequired,
  className: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  checked: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
};

Checkbox.defaultProps = {
  className: '',
  disabled: false,
};


export default ErrorBoundary(Checkbox);
