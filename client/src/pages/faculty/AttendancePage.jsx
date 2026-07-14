import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout, { PageHeader, Card, CardBody } from '../../components/Layout';
import { Button } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import { ClipboardList } from 'lucide-react';
import { useMyAttendanceSummary } from '../../hooks/useAttendance';
import { ROUTES } from '../../utils/constants';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// ── One row per duty slot in the history list. Read-only — check in/out
// lives on the Dashboard's today-duty card only, so there's a single place
// to perform the action instead of two buttons that can drift out of sync. ──
function AttendanceHistoryCard({ record }) {
  const navigate = useNavigate();
  const isToday  = isoDate(record.duty_date) === todayIST();

  const dateStr = new Date(record.duty_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{dateStr}</p>
          <p className="text-[length:13px] text-[var(--text-muted)] capitalize">{record.session_type} session</p>
        </div>
        <Badge status={record.slot_status} />
      </div>

      <div className="flex items-center gap-4">
        <div className="text-[length:13px]">
          <p className="text-[var(--text-muted)] text-xs">Check-in</p>
          <p className="font-medium">{record.in_time ? new Date(record.in_time).toLocaleTimeString() : '—'}</p>
          {record.in_status && <Badge status={record.in_status} />}
        </div>
        <div className="text-[length:13px]">
          <p className="text-[var(--text-muted)] text-xs">Check-out</p>
          <p className="font-medium">{record.out_time ? new Date(record.out_time).toLocaleTimeString() : '—'}</p>
          {record.auto_out && <span className="text-xs text-[var(--color-amber-solid)]">Auto</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!record.in_time && !record.out_time && (
            <Badge status={record.attendance_status} />
          )}
          {isToday && !record.out_time && (
            <Button size="sm" variant="light" onClick={() => navigate(ROUTES.FACULTY_DASHBOARD)}>
              {record.in_time ? 'Check out on Dashboard →' : 'Check in on Dashboard →'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionBreakdownCard({ label, stats }) {
  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-[length:12px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.06em] mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-y-2 text-[length:13px]">
        <span className="text-[var(--text-muted)]">Checked in</span>
        <span className="text-right font-semibold text-[var(--text-primary)]">{stats.checked_in}</span>
        <span className="text-[var(--text-muted)]">Checked out</span>
        <span className="text-right font-semibold text-[var(--text-primary)]">{stats.checked_out}</span>
        <span className="text-[var(--text-muted)]">Late</span>
        <span className="text-right font-semibold text-[var(--text-primary)]">{stats.late}</span>
        <span className="text-[var(--text-muted)]">Absent</span>
        <span className="text-right font-semibold text-[var(--text-primary)]">{stats.not_checked_in}</span>
        <span className="text-[var(--text-muted)]">Auto clock-out</span>
        <span className="text-right font-semibold text-[var(--text-primary)]">{stats.auto_out}</span>
      </div>
    </div>
  );
}

export default function AttendancePage({ user }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useMyAttendanceSummary(year, month);
  const records = data?.data ?? [];
  const summary = data?.summary;
  const today   = data?.today;

  const todayStr = todayIST();
  const upcoming = records.filter((r) => isoDate(r.duty_date) > todayStr);
  const past     = records.filter((r) => isoDate(r.duty_date) < todayStr);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  function renderGroup(label, group) {
    if (!group.length) return null;
    return (
      <div className="mb-6">
        <h3 className="text-[length:13px] font-semibold text-[var(--text-secondary)] mb-3">{label}</h3>
        <div className="space-y-3">
          {group.map((r) => <AttendanceHistoryCard key={r.slot_id} record={r} />)}
        </div>
      </div>
    );
  }

  return (
    <Layout user={user}>
      <PageHeader title="My Attendance" subtitle="Your own check-ins, check-outs, and monthly attendance summary" />

      {/* ── Month nav ── */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="w-11 h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-page)] text-[var(--text-secondary)] flex items-center justify-center text-base">‹</button>
        <p className="font-bold text-[15px] text-[var(--text-primary)]">{MONTH_NAMES[month - 1]} {year}</p>
        <button onClick={nextMonth} className="w-11 h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-page)] text-[var(--text-secondary)] flex items-center justify-center text-base">›</button>
      </div>

      {isLoading ? (
        <Skeleton height="200px" className="rounded-2xl mb-6" />
      ) : (
        <>
          {/* ── Monthly summary ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            <StatCard compact label="Checked in"     value={summary?.checked_in ?? 0}     accent="blue"   icon="✓" />
            <StatCard compact label="Checked out"    value={summary?.checked_out ?? 0}    accent="green"  icon="✔" />
            <StatCard compact label="Late arrivals"  value={summary?.late ?? 0}           accent="yellow" icon="⏰" />
            <StatCard compact label="Absent"         value={summary?.not_checked_in ?? 0} accent="red"    icon="⚠" />
            <StatCard compact label="Auto clock-out" value={summary?.auto_out ?? 0}       accent="indigo" icon="🔔" />
          </div>

          {/* ── Morning / afternoon breakdown ── */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <SessionBreakdownCard label="Morning session"   stats={summary.morning} />
              <SessionBreakdownCard label="Afternoon session" stats={summary.afternoon} />
            </div>
          )}

          {!records.length ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={ClipboardList}
                  title="No duty slots this month"
                  subtitle="The admin will assign your duty slots when the scheduling window opens."
                />
              </CardBody>
            </Card>
          ) : (
            <>
              {today && today.length > 0 && renderGroup("Today's duty", today)}
              {renderGroup('Upcoming', upcoming)}
              {renderGroup('Past attendance history', past)}
            </>
          )}
        </>
      )}
    </Layout>
  );
}
