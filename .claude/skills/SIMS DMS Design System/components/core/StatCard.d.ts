import * as React from 'react';

export interface StatCardProps {
  /** Uppercase label above the number. */
  label: string;
  /** The KPI value (number or string). Falls back to an em-dash. */
  value?: React.ReactNode;
  /** Optional sub-line beneath the value. */
  sub?: string;
  /** Accent color — drives the left bar + tint. @default 'default' */
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'default';
  /** Leading icon/emoji in the label. */
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * KPI tile with a colored left accent bar — use in a 2/3-col grid.
 * @startingPoint section="Core" subtitle="KPI stat tiles" viewport="700x150"
 */
export function StatCard(props: StatCardProps): JSX.Element;
export default StatCard;
