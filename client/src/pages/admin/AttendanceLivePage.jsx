import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import Badge from '../../components/ui/Badge';
import FormModal from '../../components/ui/FormModal';
import { Select, TextInput } from '@mantine/core';
import { useToast } from '../../components/ui/Toast';
import { useLiveAttendance, useOverrideAttendance } from '../../hooks/useAttendance';
import Breadcrumb from '../../components/Breadcrumb';

// ── Override modal ────────────────────────────────────────────────────────────
function OverrideModal({ record, onClose }) {
  const toast    = useToast();
  const override = useOverrideAttendance();
  const [form, setForm] = useState({
    in_status:       record?.in_status ?? 'normal',
    override_reason: '',
  });

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await override.mutateAsync({ dutySlotId: record.slot_id, ...form });
      toast({ message: 'Attendance overridden.' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <FormModal
      opened={!!record}
      onClose={onClose}
      title={`Override — ${record?.faculty?.name}`}
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Save"
      loading={override.isPending}
    >
      <Select
        label="In status"
        value={form.in_status}
        onChange={(value) => setForm((f) => ({ ...f, in_status: value ?? 'normal' }))}
        data={[
          { value: 'normal', label: 'Normal' },
          { value: 'late',   label: 'Late' },
          { value: 'absent', label: 'Absent' },
        ]}
      />
      <TextInput
        label="Reason (required)"
        value={form.override_reason}
        onChange={(e) => setForm((f) => ({ ...f, override_reason: e.target.value }))}
        required
      />
    </FormModal>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, count, color }) {
  const cls = {
    green:  'bg-emerald-bg  text-emerald-text  border-emerald-border',
    amber:  'bg-amber-bg    text-amber-text     border-amber-border',
    red:    'bg-red-bg      text-red-text       border-red-border',
    blue:   'bg-[var(--color-blue-50)]   text-[var(--brand)]         border-[var(--color-blue-200)]',
    gray:   'bg-[var(--surface-page)]    text-[var(--text-muted)]    border-[var(--border)]',
  }[color] ?? 'bg-[var(--surface-page)] text-[var(--text-muted)] border-[var(--border)]';

  return (
    <div className={`flex items-center gap-2.5 border rounded-lg px-4 py-2 ${cls}`}>
      <span className="text-xl font-bold">{count}</span>
      <span className="text-[length:12px] font-medium">{label}</span>
    </div>
  );
}

// ── Faculty card ──────────────────────────────────────────────────────────────
function FacultyCard({ record, onOverride }) {
  const borderCls =
    record.attendance_status === 'checked_in'  && record.in_status === 'late'    ? 'border-l-amber-600' :
    record.attendance_status === 'checked_in'  || record.attendance_status === 'checked_out' ? 'border-l-emerald-600' :
    record.in_status === 'absent'              ? 'border-l-red-600' :
    'border-l-[var(--border)]';

  const statusBadge =
    record.attendance_status === 'checked_out' ? 'completed' :
    record.attendance_status === 'checked_in'  ? (record.in_status === 'late' ? 'late' : 'active') :
    record.in_status === 'absent'              ? 'absent' :
    record.attendance_status === 'upcoming'    ? 'upcoming' :
    'not_checked_in';

  const timeLabel =
    record.in_time
      ? `In: ${new Date(record.in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
      : record.attendance_status === 'upcoming'
      ? 'Upcoming'
      : record.attendance_status === 'not_checked_in'
      ? 'Absent'
      : '—';

  return (
    <div
      className={`bg-[var(--surface-card)] border border-[var(--border)] border-l-4 ${borderCls} rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow`}
      onClick={() => onOverride(record)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[length:13px] font-semibold text-[var(--text-primary)] truncate">{record.faculty?.name}</p>
          <p className="text-[length:11px] text-[var(--text-muted)] truncate">{record.faculty?.department}</p>
        </div>
        <Badge
          status={record.session_type === 'morning' ? 'scheduled' : 'open'}
          label={record.session_type === 'morning' ? 'Morning' : 'Afternoon'}
        />
      </div>
      <div className="flex items-center justify-between">
        <Badge status={statusBadge} />
        <span className="text-[length:11px] text-[var(--text-muted)] font-mono">{timeLabel}</span>
      </div>
      {record.auto_out && (
        <p className="text-[length:11px] text-[var(--color-amber-solid)] mt-1.5">Auto clocked-out</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AttendanceLivePage({ user }) {
  const { data, isLoading, dataUpdatedAt } = useLiveAttendance();
  const [overriding, setOverriding] = useState(null);

  const records      = data?.data ?? [];
  const checkedIn    = records.filter(r => r.attendance_status === 'checked_in').length;
  const checkedOut   = records.filter(r => r.attendance_status === 'checked_out').length;
  const lateCount    = records.filter(r => r.in_status === 'late').length;
  const notIn        = records.filter(r => r.attendance_status === 'not_checked_in').length;
  const autoOut      = records.filter(r => r.auto_out).length;

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Attendance' }]} />
      <PageHeader
        title={<>Live Attendance <span className="font-normal text-[color:var(--text-muted)]">— {today}</span></>}
        subtitle={`Refreshes every 30s · Last updated ${lastUpdate}`}
      />

      {/* Stat pills */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatPill label="Checked in"     count={checkedIn}  color="green" />
        <StatPill label="Checked out"    count={checkedOut} color="blue"  />
        <StatPill label="Late arrivals"  count={lateCount}  color="amber" />
        <StatPill label="Absent"         count={notIn}      color="red"   />
        <StatPill label="Auto clock-out" count={autoOut}    color="gray"  />
      </div>

      {isLoading ? (
        <p className="text-[length:13px] text-[var(--text-muted)]">Loading…</p>
      ) : !records.length ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-[length:13px]">No duty slots scheduled today.</div>
      ) : (
        <>
          {records.filter(r => r.session_type === 'morning').length > 0 && (
            <div className="mb-6">
              <p className="text-[length:12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.08em] mb-3">
                Morning duty · {records.filter(r => r.session_type === 'morning').length} faculty
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {records.filter(r => r.session_type === 'morning').map((r) => (
                  <FacultyCard key={r.slot_id} record={r} onOverride={setOverriding} />
                ))}
              </div>
            </div>
          )}

          {records.filter(r => r.session_type === 'afternoon').length > 0 && (
            <div>
              <p className="text-[length:12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.08em] mb-3">
                Afternoon duty · {records.filter(r => r.session_type === 'afternoon').length} faculty
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {records.filter(r => r.session_type === 'afternoon').map((r) => (
                  <FacultyCard key={r.slot_id} record={r} onOverride={setOverriding} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {overriding && (
        <OverrideModal record={overriding} onClose={() => setOverriding(null)} />
      )}
    </Layout>
  );
}
