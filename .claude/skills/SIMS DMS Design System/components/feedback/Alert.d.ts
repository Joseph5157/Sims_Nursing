import * as React from 'react';

export interface AlertProps {
  /** Tone — drives tint + left accent. @default 'info' */
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'telegram';
  /** Leading emoji/icon. */
  icon?: React.ReactNode;
  /** Bold heading line. */
  title?: string;
  /** Body text. */
  children?: React.ReactNode;
  /** Right-aligned action (small button/link). */
  action?: React.ReactNode;
  /** Makes the whole banner tappable. */
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * Inline notification banner — tinted card with a 3px left accent.
 * @startingPoint section="Feedback" subtitle="Inline alert banners" viewport="700x240"
 */
export function Alert(props: AlertProps): JSX.Element;
export default Alert;
