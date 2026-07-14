import { useNavigate } from 'react-router-dom';
import Layout, { PageHeader } from '../../components/Layout';
import StatCard from '../../components/ui/StatCard';
import Alert from '../../components/ui/Alert';
import { useUsers } from '../../hooks/useUsers';
import { useAuditLogs } from '../../hooks/useUsers';
import { ROUTES } from '../../utils/constants';

const ACTION_LABELS = {
  USER_CREATED:              'User created',
  USER_DEACTIVATED:          'User deactivated',
  USER_REACTIVATED:          'User reactivated',
  USER_HARD_DELETED:         'User hard-deleted',
  SESSION_RESET:             'Session reset',
  CALENDAR_WINDOW_OPEN:      'Calendar window opened',
  CALENDAR_WINDOW_CLOSE:     'Calendar window closed',
  CALENDAR_BLOCKED_DATES_UPDATE: 'Blocked dates updated',
  CALENDAR_WORKING_DAYS_UPDATE:  'Working days updated',
  CALENDAR_SESSIONS_UPDATE:      'Sessions/faculty updated',
  ADMIN_ASSIGN_SLOTS:        'Slots assigned',
  VIOLATION_FLAG_RESOLVED:   'Student violation flag resolved',
  VIOLATION_HIDDEN:          'Student violation hidden',
};

function fmtAction(action) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase();
}

export default function SuperAdminDashboardPage({ user }) {
  const navigate = useNavigate();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const { data: allUsers }     = useUsers({ limit: '100' });
  const { data: pendingUsers } = useUsers({ status: 'pending' });
  const { data: auditData }    = useAuditLogs({ limit: 10 });

  const totalUsers    = allUsers?.meta?.total ?? allUsers?.data?.length ?? 0;
  const totalFaculty  = allUsers?.data?.filter(u => u.role === 'faculty').length ?? 0;
  const totalAdmins   = allUsers?.data?.filter(u => u.role === 'admin').length ?? 0;
  const pendingCount  = pendingUsers?.meta?.total ?? pendingUsers?.data?.length ?? 0;

  const logs = auditData?.data ?? [];

  return (
    <Layout user={user}>
      <PageHeader title="Super Admin Dashboard" subtitle={dateStr} />

      {/* ── Pending account approvals alert ── */}
      {pendingCount > 0 && (
        <Alert tone="warning" icon="⏳" className="mb-3"
          title={`${pendingCount} account${pendingCount !== 1 ? 's' : ''} awaiting approval`}
          onClick={() => navigate(ROUTES.ADMIN_USERS + '?status=pending')}>
          Tap to review and approve.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <StatCard label="Total users" value={totalUsers} accent="blue" icon="👥"
          onClick={() => navigate(ROUTES.ADMIN_USERS)} />
        <StatCard label="Faculty" value={totalFaculty} accent="green" icon="🎓"
          onClick={() => navigate(ROUTES.ADMIN_USERS + '?role=faculty')} />
        <StatCard label="Admins" value={totalAdmins} accent="yellow" icon="⚡"
          onClick={() => navigate(ROUTES.ADMIN_USERS + '?role=admin')} />
        <StatCard
          label="Pending approvals"
          value={pendingCount}
          accent="red"
          sub={pendingCount > 0 ? 'Needs action' : 'All clear'}
          icon="⏳"
          onClick={() => navigate(ROUTES.ADMIN_USERS + '?status=pending')}
        />
      </div>

      {/* Recent activity */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2 pl-1 pr-1">
          <p className="text-[length:var(--text-micro)] font-bold text-[var(--text-muted)] uppercase tracking-[var(--tracking-wide)]">
            Recent system activity
          </p>
          <button
            onClick={() => navigate(ROUTES.SUPER_ADMIN_AUDIT)}
            style={{ fontSize: 'var(--text-small)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
          >
            View all →
          </button>
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-2xl)] border border-[var(--border)] overflow-hidden">
          {!logs.length ? (
            <div className="px-4 py-10 text-center"
              style={{ color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>
              No audit log entries yet.
            </div>
          ) : (
            logs.map((entry, i) => (
              <div key={entry.id}
                className="flex justify-between items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ fontSize: 'var(--text-card)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                    {fmtAction(entry.action)}
                  </p>
                  <p className="mt-[2px]"
                    style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                    by {entry.actor?.name ?? 'System'} · {entry.target_type}
                  </p>
                </div>
                <p className="shrink-0"
                  style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                  {new Date(entry.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short',
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
