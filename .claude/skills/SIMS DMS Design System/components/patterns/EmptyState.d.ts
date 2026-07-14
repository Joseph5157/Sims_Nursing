import * as React from 'react';

export interface EmptyStateProps {
  /** Large emoji glyph. @default '📭' */
  emoji?: string;
  /** Bold title line. */
  title: string;
  /** Muted explanatory line. */
  subtitle?: string;
  /** Optional CTA (usually a <Button/>). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Centered empty-list placeholder (RULE 7) — never show a blank screen. */
export function EmptyState(props: EmptyStateProps): JSX.Element;
export default EmptyState;
