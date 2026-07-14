import * as React from 'react';

export interface SelectOption { value: string; label: string; }

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Uppercase field label. */
  label?: string;
  /** Error message — paints the field red. */
  error?: string;
  /** Options as strings or { value, label } objects. */
  options?: Array<string | SelectOption>;
  /** Leading empty placeholder option. */
  placeholder?: string;
}

/** Native dropdown styled to match Input — custom chevron, blue focus ring. */
export function Select(props: SelectProps): JSX.Element;
export default Select;
