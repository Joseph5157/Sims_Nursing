import * as React from 'react';

export interface SectionHeaderProps {
  /** Uppercase section label. */
  title: string;
  /** Right-aligned node (link, "See all", small button). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Uppercase muted label that precedes every list/section (RULE 4). */
export function SectionHeader(props: SectionHeaderProps): JSX.Element;
export default SectionHeader;
