import * as React from 'react';

export type BadgeStatus =
  | 'active' | 'inactive' | 'pending' | 'pending_telegram'
  /** PendingInvite row — link sent, user not yet created */
  | 'invited'
  /** PendingInvite row — link has expired */
  | 'invite_expired'
  | 'open' | 'covered' | 'expired' | 'cancelled' | 'cover_pending'
  | 'scheduled' | 'completed' | 'absent' | 'normal' | 'late' | 'hidden'
  | 'flagged' | 'not_checked_in' | 'checked_in' | 'checked_out'
  | 'super_admin' | 'admin' | 'faculty';

export interface BadgeProps {
  /** Known status/role key — drives color + default label. */
  status?: BadgeStatus | string;
  /** Override the displayed text. */
  label?: string;
  style?: React.CSSProperties;
}

/**
 * Compact status / role pill with the product's canonical color mapping.
 * @startingPoint section="Core" subtitle="Status & role badges" viewport="700x150"
 */
export function Badge(props: BadgeProps): JSX.Element;
export default Badge;
