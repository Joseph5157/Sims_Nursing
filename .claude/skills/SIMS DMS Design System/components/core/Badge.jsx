import React from 'react';

const STATUS = {
  // ── User account ──
  active:           ['#d1fae5', 'var(--emerald-text)', 'Active'],
  inactive:         ['var(--slate-100)', 'var(--slate-500)', 'Inactive'],
  pending:          ['#fde68a', 'var(--amber-text)', 'Pending'],
  pending_telegram: ['#cffafe', 'var(--cyan-text)', 'Awaiting Telegram'],

  // ── Invite flow (PendingInvite rows — not yet a user) ──
  invited:          ['var(--blue-50)', 'var(--blue-700)', 'Invite sent'],
  invite_expired:   ['#fecaca', 'var(--red-text)', 'Link expired'],

  // ── Duty slots ──
  open:             ['var(--blue-100)', 'var(--blue-700)', 'Open'],
  covered:          ['#d1fae5', 'var(--emerald-text)', 'Covered'],
  expired:          ['#fecaca', 'var(--red-text)', 'Expired'],
  cancelled:        ['var(--slate-100)', 'var(--slate-500)', 'Cancelled'],
  cover_pending:    ['#fed7aa', 'var(--orange-text)', 'Cover needed'],
  scheduled:        ['var(--blue-100)', 'var(--blue-700)', 'Scheduled'],
  completed:        ['#d1fae5', 'var(--emerald-text)', 'Completed'],

  // ── Attendance ──
  absent:           ['#fecaca', 'var(--red-text)', 'Absent'],
  normal:           ['#d1fae5', 'var(--emerald-text)', 'On time'],
  late:             ['#fde68a', 'var(--amber-text)', 'Late'],
  not_checked_in:   ['var(--slate-100)', 'var(--slate-500)', 'Not in'],
  checked_in:       ['var(--blue-100)', 'var(--blue-700)', 'Checked in'],
  checked_out:      ['#d1fae5', 'var(--emerald-text)', 'Checked out'],

  // ── Misc ──
  hidden:           ['var(--slate-100)', 'var(--slate-400)', 'Hidden'],
  flagged:          ['#fde68a', 'var(--amber-text)', '⚑ Flagged'],

  // ── Roles ──
  super_admin:      ['#ede9fe', 'var(--purple-text)', 'Super Admin'],
  admin:            ['#fde68a', 'var(--amber-text)', 'Admin'],
  faculty:          ['var(--blue-100)', 'var(--blue-700)', 'Faculty'],
};

/**
 * Badge — a compact status / role pill. Pass a known `status` to get the
 * product's canonical color + label, or override `label` for custom text.
 */
export function Badge({ status, label, style = {} }) {
  const [bg, color, defaultLabel] = STATUS[status] ?? ['var(--slate-100)', 'var(--slate-500)', status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--radius-full)',
        padding: '2px 8px',
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        background: bg,
        color,
        ...style,
      }}
    >
      {label ?? defaultLabel}
    </span>
  );
}

export default Badge;
