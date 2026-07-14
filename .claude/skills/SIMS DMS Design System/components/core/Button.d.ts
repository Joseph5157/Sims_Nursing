import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default 'primary' */
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
  /** Control size. `default` keeps a 44px mobile tap target. @default 'default' */
  size?: 'xs' | 'sm' | 'default' | 'lg';
  /** Show a spinner and disable the button. */
  loading?: boolean;
  /** Leading icon node (Lucide icon or emoji). */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * The product's primary action control — 6 variants, 4 sizes.
 * @startingPoint section="Core" subtitle="Buttons in every variant & size" viewport="700x180"
 */
export function Button(props: ButtonProps): JSX.Element;
export default Button;
