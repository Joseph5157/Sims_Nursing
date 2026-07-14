import { STATUS_COLORS, ROLE_COLORS } from '../../utils/constants';

const STATUS_LABELS = {
  active:           'Active',
  inactive:         'Inactive',
  pending:          'Pending',
  pending_telegram: 'Awaiting Telegram',
  invited:          'Invite sent',
  invite_expired:   'Link expired',
  scheduled:        'Scheduled',
  completed:        'Completed',
  absent:           'Absent',
  reassigned:       'Reassigned',
  normal:           'On time',
  late:             'Late',
  hidden:           'Hidden',
  flagged:          '⚑ Flagged',
  not_checked_in:   'Absent',
  upcoming:         'Upcoming',
  checked_in:       'Checked in',
  checked_out:      'Checked out',
  super_admin:      'Super Admin',
  admin:            'Admin',
  faculty:          'Faculty',
};

export default function Badge({ status, label, className = '' }) {
  const isRole = status === 'super_admin' || status === 'admin' || status === 'faculty';
  const cls = isRole
    ? (ROLE_COLORS[status] ?? 'bg-[var(--surface-page)] text-[var(--text-muted)]')
    : (STATUS_COLORS[status] ?? 'bg-[var(--surface-page)] text-[var(--text-muted)]');

  const displayLabel = label ?? STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[length:12px] font-semibold whitespace-nowrap ${cls} ${className}`}
      style={{ letterSpacing: '0.02em' }}
    >
      {displayLabel}
    </span>
  );
}
