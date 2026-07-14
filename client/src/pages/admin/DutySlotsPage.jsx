import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Table, Th, Td, EmptyRow, ErrorRow, ErrorBlock } from '../../components/ui/Table';
import { Select, Modal, Textarea, Button } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import { useMonthSlots, useReassignSlot } from '../../hooks/useDutySlots';
import { useMessageRecipients } from '../../hooks/useUsers';
import { useToast } from '../../components/ui/Toast';
import Breadcrumb from '../../components/Breadcrumb';
import useKeyboardInset from '../../hooks/useKeyboardInset';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Compact at-a-glance count shown in the header band (number + muted label).
function Stat({ n, label }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[length:18px] font-extrabold leading-none text-[var(--text-primary)]">{n}</span>
      <span className="text-[length:11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Check if a slot is upcoming (today or in the future)
function isUpcoming(s) {
  return String(s.duty_date).slice(0, 10) >= todayStr();
}

// A duty can be reassigned only while it is still scheduled and its date has not
// passed — matching the server-side guard.
function isReassignable(s) {
  return s.status === 'scheduled' && isUpcoming(s);
}

const STATUS_FILTERS = [
  { value: 'upcoming',  label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired',   label: 'Absent' },
  { value: 'all',       label: 'All' },
];

// Match a slot against the selected status filter. "Absent" covers past
// slots that were never completed (still scheduled, or marked absent) —
// distinct from "Completed" which is past slots that were actually attended.
// (Internal filter value stays 'expired'; only the label reads "Absent".)
function matchesStatusFilter(s, filter) {
  const upcoming = isUpcoming(s);
  switch (filter) {
    case 'upcoming':  return upcoming;
    case 'completed': return s.status === 'completed';
    case 'expired':   return !upcoming && s.status !== 'completed';
    case 'all':       return true;
    default:          return upcoming;
  }
}

export default function DutySlotsPage({ user }) {
  const now = new Date();
  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState('upcoming');

  const { data, isLoading, isError, refetch } = useMonthSlots(year, month);

  const toast = useToast();
  const reassign = useReassignSlot();
  const kbInset = useKeyboardInset();
  // /users/directory — active users, self excluded; filter to faculty for the picker.
  const { data: facultyResp } = useMessageRecipients();
  const facultyList = (facultyResp?.data ?? []).filter((u) => u.role === 'faculty');

  const [target, setTarget] = useState(null); // slot being reassigned
  const [toFacultyId, setToFacultyId] = useState(null);
  const [reason, setReason] = useState('');

  const slots = data?.data ?? [];
  // Default view shows only upcoming slots; admin can switch to Completed / Absent / All
  // to pull up history without mixing it into the active list.
  const filteredSlots = slots.filter((s) => matchesStatusFilter(s, statusFilter));
  const morning   = filteredSlots.filter((s) => s.session_type === 'morning');
  const afternoon = filteredSlots.filter((s) => s.session_type === 'afternoon');

  function openReassign(slot) {
    setTarget(slot);
    setToFacultyId(null);
    setReason('');
  }

  function closeReassign() {
    if (reassign.isPending) return;
    setTarget(null);
  }

  async function confirmReassign() {
    if (!target || !toFacultyId) return;
    try {
      await reassign.mutateAsync({ id: target.id, to_faculty_id: toFacultyId, reason: reason.trim() || undefined });
      toast({ message: 'Duty reassigned. Both faculty notified via Telegram.' });
      setTarget(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed to reassign duty.', type: 'error' });
    }
  }

  // Faculty options for the modal, excluding the slot's current owner.
  const facultyOptions = facultyList
    .filter((f) => f.id !== target?.faculty_id)
    .map((f) => ({ value: f.id, label: f.department ? `${f.name} · ${f.department}` : f.name }));

  function reassignedFromLabel(s) {
    const r = s.reassignments?.[0];
    return r ? `↩ from ${r.fromFaculty?.name ?? '—'}` : '—';
  }

  const statusFilterLabel = (STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? 'Upcoming').toLowerCase();

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Duty Slots' }]} />
      <PageHeader title="Duty Slots" subtitle="Monthly slot assignments" />

      <div className="max-w-[1080px] mx-auto">
      {/* Filters + at-a-glance counts — split totals visible without scrolling */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-4 mb-6">
        <Select
          w={100}
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          data={[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => ({ value: String(y), label: String(y) }))}
        />
        <Select
          w={120}
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          data={MONTHS.map((m, i) => ({ value: String(i+1), label: m }))}
        />
        <Select
          w={130}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v ?? 'upcoming')}
          data={STATUS_FILTERS}
        />
        <div className="flex items-center gap-5 w-full sm:w-auto sm:ml-auto">
          <Stat n={morning.length} label="Morning" />
          <Stat n={afternoon.length} label="Afternoon" />
          <Stat n={filteredSlots.length} label="Total" />
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden">
        {['morning', 'afternoon'].map((session) => {
          const group = session === 'morning' ? morning : afternoon;
          return (
            <div key={session} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)', marginBottom: 8 }}>
                {session} slots ({group.length})
              </p>
              <div style={{ backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)',
                overflow: 'hidden', marginBottom: 16 }}>
                {isError ? (
                  <ErrorBlock onRetry={refetch} />
                ) : !group.length ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>
                    No {statusFilterLabel} {session} slots
                  </div>
                ) : (
                  group.map((s) => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', backgroundColor: 'var(--surface-card)',
                      borderBottom: '1px solid var(--border)', gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 'var(--text-card-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.faculty?.name}
                        </p>
                        <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                          {new Date(s.duty_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          {s.reassignments?.length ? ` · ${reassignedFromLabel(s)}` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <Badge status={s.status} />
                        {isReassignable(s) && (
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => openReassign(s)}
                            styles={{ root: { minHeight: 'var(--control-min)' } }}
                          >
                            Reassign
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
      {['morning', 'afternoon'].map((session) => {
        const group = session === 'morning' ? morning : afternoon;
        return (
          <div key={session} className="mb-6">
            <h3 className="text-[length:13px] font-semibold text-[var(--text-secondary)] mb-2 capitalize">{session} slots ({group.length})</h3>
            <Table>
              <thead><tr><Th>Date</Th><Th>Faculty</Th><Th>Department</Th><Th>Status</Th><Th>Action</Th></tr></thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {isLoading && <EmptyRow cols={5} message="Loading…" />}
                {isError && <ErrorRow cols={5} onRetry={refetch} />}
                {!isLoading && !isError && !group.length && <EmptyRow cols={5} message={`No ${statusFilterLabel} ${session} slots.`} />}
                {group.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium whitespace-nowrap">{new Date(s.duty_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</Td>
                    <Td>
                      <span className="text-[var(--text-primary)]">{s.faculty?.name}</span>
                      {s.reassignments?.length ? (
                        <span className="block text-[length:12px] text-[var(--color-indigo-text)] mt-0.5">{reassignedFromLabel(s)}</span>
                      ) : null}
                    </Td>
                    <Td>{s.faculty?.department ?? '—'}</Td>
                    <Td><Badge status={s.status} /></Td>
                    <Td>
                      {isReassignable(s)
                        ? <Button size="compact-xs" variant="light" onClick={() => openReassign(s)}>Reassign</Button>
                        : <span className="text-[var(--text-muted)]">—</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        );
      })}
      </div>
      </div>

      {/* Reassign Duty modal */}
      <Modal
        opened={!!target}
        onClose={closeReassign}
        title="Reassign Duty"
        // Top-anchored (not centered) + keyboard inset so the faculty picker and its
        // dropdown stay above the on-screen keyboard on mobile. See useKeyboardInset.
        styles={{
          inner: { alignItems: 'flex-start', paddingBottom: kbInset ? kbInset + 16 : undefined },
          content: kbInset ? { maxHeight: `calc(100dvh - ${kbInset}px - 10dvh)` } : undefined,
        }}
      >
        {target && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-page)] p-3 text-[length:13px]">
              <div className="flex justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Current faculty</span>
                <span className="font-semibold text-[var(--text-primary)]">{target.faculty?.name}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Duty date</span>
                <span className="text-[var(--text-primary)]">{new Date(target.duty_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-[var(--text-muted)]">Session</span>
                <span className="capitalize text-[var(--text-primary)]">{target.session_type}</span>
              </div>
              <div className="flex justify-between py-0.5 items-center">
                <span className="text-[var(--text-muted)]">Status</span>
                <Badge status={target.status} />
              </div>
            </div>

            <Select
              label="Reassign to"
              placeholder="Select another faculty"
              searchable
              data={facultyOptions}
              value={toFacultyId}
              onChange={setToFacultyId}
              nothingFoundMessage="No faculty found"
              comboboxProps={{ withinPortal: false }}
              maxDropdownHeight={200}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: 'nearest' }), 100)}
            />

            <Textarea
              label="Reason (optional)"
              placeholder="e.g. Faculty requested reassignment due to personal reason"
              autosize
              minRows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="default" onClick={closeReassign} disabled={reassign.isPending}>Cancel</Button>
              <Button onClick={confirmReassign} loading={reassign.isPending} disabled={!toFacultyId}>Confirm Reassignment</Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
