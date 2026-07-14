import * as React from 'react';

export interface MobileCardProps {
  /** Primary line — name/title, 15px semibold. */
  primary: React.ReactNode;
  /** Secondary meta line — 12px muted. */
  secondary?: React.ReactNode;
  /** Right-aligned status pill (use <Badge/>). */
  badge?: React.ReactNode;
  /** Right-aligned action (small button/icon). */
  action?: React.ReactNode;
  /** Makes the row tappable + shows hover. */
  onClick?: () => void;
  /** Show the trailing chevron when clickable. @default true */
  showChevron?: boolean;
}

/**
 * Canonical mobile list row (RULE 3) — replaces tables on small screens.
 * @startingPoint section="Patterns" subtitle="Mobile list rows" viewport="700x220"
 */
export function MobileCard(props: MobileCardProps): JSX.Element;
export default MobileCard;
