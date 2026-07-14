import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Uppercase field label. */
  label?: string;
  /** Error message — also paints the field red. */
  error?: string;
  /** Helper text shown when there's no error. */
  hint?: string;
}

/**
 * Labelled text field — 44px tall, blue focus ring, error + hint states.
 * @startingPoint section="Forms" subtitle="Text inputs & states" viewport="700x200"
 */
export function Input(props: InputProps): JSX.Element;
export default Input;
