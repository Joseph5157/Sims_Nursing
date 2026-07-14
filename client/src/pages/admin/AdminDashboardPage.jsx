import { useState } from 'react';
import Layout, { Card, CardHeader, CardBody } from '../../components/Layout';
import { APP_SHORT_NAME } from '../../utils/branding';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import { useUsers } from '../../hooks/useUsers';
import { useLiveAttendance } from '../../hooks/useAttendance';
import { useFlaggedViolations, useDutyReassignmentReport } from '../../hooks/useReports';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../../components/ui/Skeleton';
import { ROUTES } from '../../utils/constants';
import {
  IconUsers, IconHourglass, IconRefresh, IconFlag,
  IconClipboardCheck, IconAlertTriangle, IconChartBar, IconBrandTelegram,
} from '@tabler/icons-react';

const QUICK_ACTIONS = [
  { label: 'Student Violations', Icon: IconAlertTriangle, path: ROUTES.ADMIN_VIOLATIONS,   tint: 'var(--color-red-bg)',     ink: 'var(--color-red-text)', primary: true },
  { label: 'Reports',            Icon: IconChartBar,      path: ROUTES.ADMIN_REPORTS,       tint: 'var(--color-purple-bg)',  ink: 'var(--color-purple-text)' },
];

export default function AdminDashboardPage({ user }) {
  const navigate = useNavigate();
  // Active Faculty, Reassignments, and Flagged used to each have their own
  // duplicate detail modal here — removed in favor of linking to the real
  // Attendance / Reports / Flagged Violations pages that already show the
  // same (and more complete) data.
  const [flaggedShowCount, setFlaggedShowCount] = useState(5);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const { data: allUsers, isLoading }  = useUsers({ role: 'faculty', status: 'active', limit: '100' });
  const { data: pendingUsers }       = useUsers({ status: 'pending' });
  const { data: pendingTelegramUsers } = useUsers({ status: 'pending_telegram' });
  const { data: liveData }           = useLiveAttendance();
  const { data: reassignReport }     = useDutyReassignmentReport({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { data: flagged }            = useFlaggedViolations();

  const activeFaculty       = allUsers?.meta?.total ?? allUsers?.data?.length ?? 0;
  const pendingCount        = pendingUsers?.meta?.total  ?? pendingUsers?.data?.length ?? 0;
  const pendingTelegramCount = pendingTelegramUsers?.meta?.total ?? pendingTelegramUsers?.data?.length ?? 0;
  const reassignments       = reassignReport?.history ?? [];
  const reassignmentCount   = reassignReport?.total ?? 0;
  const pendingFlaggedCount = flagged?.pending_count ?? 0;

  const liveSlots    = liveData?.data ?? [];
  const checkedIn    = liveSlots.filter((s) => s.attendance_status === 'checked_in').length;
  const checkedOut   = liveSlots.filter((s) => s.attendance_status === 'checked_out').length;
  const notCheckedIn = liveSlots.filter((s) => s.attendance_status === 'not_checked_in').length;
  const lateCount    = liveSlots.filter((s) => s.in_status === 'late').length;

  const allFlaggedViolations = (flagged?.data ?? []).filter((v) => v.is_flagged);
  const pendingFlaggedViolations = allFlaggedViolations.slice(0, flaggedShowCount);
  const hasFlagged = pendingFlaggedCount > 0;

  return (
    <Layout user={user}>
      <div className="max-w-[1200px] mx-auto">
      {/* ── Gradient brand header — greeting + live at-a-glance ── */}
      <div className="mb-5 rounded-[var(--radius-2xl)] px-5 py-4 flex items-center justify-between gap-3"
        style={{ background: 'var(--brand-gradient-deep)', boxShadow: '0 8px 24px -8px rgba(37,99,235,0.45)' }}>
        <div className="min-w-0">
          <p className="text-[length:var(--text-h2)] font-extrabold leading-tight text-white truncate">
            Good {getGreeting()}, {user?.title ? `${user.title} ` : ''}{user?.name}
          </p>
          <p className="text-[length:var(--text-small)] mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {dateStr} · {APP_SHORT_NAME} Admin
          </p>
        </div>
        {liveSlots.length > 0 && (
          <div className="hidden sm:inline-flex items-center gap-2 shrink-0 rounded-full px-3.5 py-2 text-[length:var(--text-small)] font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 0 3px rgba(74,222,128,0.3)' }} />
            {checkedIn} checked in
          </div>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="68px" className="rounded-xl" />)}
          </div>
          <Skeleton height="140px" className="rounded-xl mb-3" />
          <Skeleton height="140px" className="rounded-xl" />
        </>
      )}

      {/* ── KPI hierarchy — hero (Active Faculty) leads, supporting stats recede ── */}
      {!isLoading && (
        <div className="grid grid-cols-3 md:grid-cols-[1.7fr_1fr_1fr_1fr] gap-2 md:gap-3 mb-4">
          {/* Hero — clickable: goes to the Live Attendance page (same faculty/duty data) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(ROUTES.ADMIN_ATTENDANCE)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(ROUTES.ADMIN_ATTENDANCE); } }}
            className="col-span-3 md:col-span-1 rounded-[var(--radius-xl)] p-4 flex flex-col justify-center border cursor-pointer transition-transform hover:-translate-y-px"
            style={{
              background: 'linear-gradient(135deg, var(--color-blue-50), var(--color-indigo-bg))',
              borderColor: 'var(--color-indigo-border)',
              boxShadow: 'var(--shadow-stat)',
            }}>
            <p className="m-0 text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5" style={{ color: 'var(--color-indigo-text)' }}>
              <IconUsers size={13} stroke={1.75} /> Active Faculty
            </p>
            <p className="m-0 mt-1.5 text-[length:var(--text-stat)] font-extrabold leading-none tracking-[var(--tracking-tight)]" style={{ color: 'var(--color-blue-700)' }}>
              {activeFaculty}
            </p>
            <p className="m-0 mt-1 text-[length:var(--text-small)]" style={{ color: 'var(--text-secondary)' }}>
              <b style={{ color: 'var(--color-blue-700)' }}>{liveSlots.length}</b> on duty today
            </p>
          </div>
          {/* Supporting — subtle tonal fills, each clickable to view details */}
          <StatCard tonal compact label="Pending"          value={pendingCount}          accent="yellow"
            sub={pendingCount > 0 ? 'Needs action' : 'All clear'} icon={<IconHourglass size={14} stroke={1.75} />}
            onClick={() => navigate(ROUTES.ADMIN_USERS + '?status=pending')} />
          <StatCard tonal compact label="Reassignments"    value={reassignmentCount}     accent="indigo" icon={<IconRefresh size={14} stroke={1.75} />}
            sub="This month" onClick={() => navigate(ROUTES.ADMIN_REPORTS)} />
          <StatCard tonal compact label="Flagged"          value={pendingFlaggedCount}   accent="red"
            sub={pendingFlaggedCount > 0 ? 'Awaiting review' : 'None pending'} icon={<IconFlag size={14} stroke={1.75} />}
            onClick={() => navigate(ROUTES.ADMIN_FLAGGED_VIOLATIONS)} />
        </div>
      )}

      {/* ── Pending account approvals alert ── */}
      {pendingCount > 0 && (
        <Alert tone="warning" icon={<IconHourglass size={18} stroke={1.9} style={{ color: 'var(--color-amber-solid)' }} />} className="mb-3"
          title={`${pendingCount} account${pendingCount !== 1 ? 's' : ''} awaiting approval`}
          onClick={() => navigate(ROUTES.ADMIN_USERS)}>
          Tap to review and approve.
        </Alert>
      )}

      {/* ── Pending Telegram invites alert ── */}
      {pendingTelegramCount > 0 && (
        <Alert tone="telegram" icon={<IconBrandTelegram size={18} stroke={1.9} style={{ color: 'var(--color-cyan-solid)' }} />} className="mb-3"
          title={`${pendingTelegramCount} user${pendingTelegramCount !== 1 ? 's' : ''} haven't linked Telegram yet`}
          onClick={() => navigate(ROUTES.ADMIN_USERS + '?status=pending_telegram')}>
          Resend invite links from the Users page.
        </Alert>
      )}

      {/* ── Main dashboard grid — single column on mobile, two columns on desktop.
           Columns stretch to equal height so a short column's card fills the
           leftover space instead of leaving a blank gap before Quick actions. ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 md:items-stretch">
      {/* Left column */}
      <div className="flex flex-col gap-3 h-full">
      {/* ── Today's attendance ── */}
      <Card className="flex flex-col flex-1">
        <CardHeader>
          <span className="inline-flex items-center gap-1.5"><IconClipboardCheck size={15} stroke={1.75} className="shrink-0" />Today's attendance</span>
        </CardHeader>
        <CardBody className="p-0 flex-1 flex flex-col min-h-0">
          {!liveSlots.length ? (
            <div className="flex-1 flex items-center justify-center">
              <p style={{ fontSize: 'var(--text-card)', color: 'var(--text-muted)' }}>No duty slots scheduled today.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 px-4 py-2 border-b border-[var(--border)] shrink-0">
                {[
                  { n: checkedOut,    label: 'Out',    color: 'var(--color-emerald-solid)', tint: 'var(--color-emerald-bg)' },
                  { n: checkedIn,     label: 'In',     color: 'var(--brand)',               tint: 'var(--color-blue-50)' },
                  { n: notCheckedIn,  label: 'Absent', color: 'var(--text-muted)',          tint: 'var(--surface-page)' },
                  ...(lateCount > 0 ? [{ n: lateCount, label: 'Late', color: 'var(--color-amber-solid)', tint: 'var(--color-amber-bg)' }] : []),
                ].map((item) => (
                  <div key={item.label} className="flex-1 rounded-[var(--radius-lg)] px-2 py-1.5 text-center"
                    style={{ background: item.tint }}>
                    <p style={{ fontSize: 'var(--text-card-lg)', fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.n}</p>
                    <p style={{ fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {liveSlots.map((s) => (
                  <div
                    key={s.slot_id}
                    className="flex items-center justify-between px-4 py-[6px] border-b border-[var(--divider)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 'var(--text-card)', color: 'var(--color-slate-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.faculty?.name}
                      </p>
                    </div>
                    <span className="shrink-0 mr-[10px]"
                      style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {s.session_type}
                    </span>
                    <Badge
                      status={
                        s.attendance_status === 'checked_out' ? 'completed' :
                        s.attendance_status === 'checked_in'  ? 'checked_in' :
                        'not_checked_in'
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>
      </div>{/* /left column */}

      {/* Right column */}
      <div className="flex flex-col gap-3 h-full">
      {/* ── Recent duty reassignments (this month) — grows to fill the column only
           when there's no Flagged card below it to absorb the leftover space. ── */}
      <Card className={!hasFlagged ? 'flex flex-col flex-1' : ''}>
        <CardHeader><span className="inline-flex items-center gap-1.5"><IconRefresh size={15} stroke={1.75} className="shrink-0" />Recent duty reassignments</span></CardHeader>
        <CardBody className={`p-0 ${!hasFlagged ? 'flex-1 flex flex-col min-h-0' : ''}`}>
          {!reassignments.length ? (
            <div className={!hasFlagged ? 'flex-1 flex items-center justify-center' : ''}>
              <p style={{ padding: !hasFlagged ? 0 : '10px 16px', fontSize: 'var(--text-card)', color: 'var(--text-muted)' }}>No reassignments this month.</p>
            </div>
          ) : (
            <div className={!hasFlagged ? 'flex-1 min-h-0 overflow-y-auto' : 'max-h-[180px] overflow-y-auto'}>
              {reassignments.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-[6px] border-b border-[var(--divider)] gap-[10px]"
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 'var(--text-card)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-slate-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.from_faculty?.name} → {r.to_faculty?.name}
                    </p>
                    <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 1, textTransform: 'capitalize' }}>
                      {r.session_type}
                      {r.duty_date && ` · ${new Date(r.duty_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                    </p>
                  </div>
                  <Badge status="reassigned" />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Flagged violations requiring review — last card in the column, so it grows
           to match the left column's height instead of leaving a gap below it. ── */}
      {hasFlagged && (
        <Card className="flex flex-col flex-1">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-1">
              <span className="inline-flex items-center gap-1.5"><IconFlag size={15} stroke={1.75} className="shrink-0" />Flagged student violations — needs review</span>
              <select
                value={flaggedShowCount}
                onChange={(e) => setFlaggedShowCount(Number(e.target.value))}
                aria-label="Number of flagged violations to show"
                style={{
                  fontSize: 'var(--text-micro)', fontWeight: 600, color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  padding: '2px 6px', background: 'var(--surface-card)', cursor: 'pointer',
                }}
              >
                {[3, 5, 10, 20].map((n) => <option key={n} value={n}>Show {n}</option>)}
              </select>
            </div>
          </CardHeader>
          <div className="px-4 pt-1.5 pb-0.5 shrink-0" style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
            Total: <strong style={{ color: 'var(--text-secondary)' }}>{pendingFlaggedCount}</strong> · Showing: {pendingFlaggedViolations.length} latest
          </div>
          <CardBody className="p-0 flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
              {pendingFlaggedViolations.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between px-4 py-[9px] border-b border-[var(--divider)] gap-[10px]"
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 'var(--text-card)', color: 'var(--color-slate-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.student?.student_name}
                    </p>
                    <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 1 }}>
                      {v.violationType?.name}{v.flag_note ? ` · ${v.flag_note.slice(0, 40)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0"
                    style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-amber-text)' }}>
                    {v.faculty?.name}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-[var(--divider)] shrink-0">
              <button
                onClick={() => navigate(ROUTES.ADMIN_FLAGGED_VIOLATIONS)}
                style={{ fontSize: 'var(--text-small)', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Review all flagged student violations →
              </button>
            </div>
          </CardBody>
        </Card>
      )}
      </div>{/* /right column */}
      </div>{/* /main dashboard grid */}

      {/* ── Quick actions ── */}
      <div>
        <p style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--weight-bold)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', marginBottom: 10 }}>
          Quick actions
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px]">
          {QUICK_ACTIONS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 rounded-[var(--radius-2xl)] px-[14px] py-[14px] cursor-pointer text-left transition-all hover:-translate-y-px ${
                item.primary ? 'text-white' : 'bg-[var(--surface-card)] border border-[var(--border)] hover:border-[var(--brand)]'
              }`}
              style={{
                minHeight: 'var(--control-min)',
                ...(item.primary ? { background: 'var(--brand-gradient-deep)', boxShadow: '0 6px 16px -6px rgba(37,99,235,0.5)' } : {}),
              }}
            >
              <span className="w-10 h-10 rounded-[var(--radius-lg)] shrink-0 flex items-center justify-center"
                style={{ background: item.primary ? 'rgba(255,255,255,0.18)' : item.tint }}>
                <item.Icon size={20} stroke={1.9} style={{ color: item.primary ? '#fff' : item.ink }} />
              </span>
              <span style={{ fontSize: 'var(--text-card)', fontWeight: 'var(--weight-bold)', color: item.primary ? '#fff' : 'var(--text-primary)' }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      </div>{/* /max-width wrapper */}
    </Layout>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
