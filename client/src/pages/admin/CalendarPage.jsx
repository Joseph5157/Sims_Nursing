import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Button, TextInput, Select, NumberInput } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import FormModal from '../../components/ui/FormModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Table, Th, Td } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { useCalendar, useOpenWindow, useCloseWindow, useUpdateBlockedDates, useUpdateSessionsPerFaculty, useUnassignedFaculty, useAssignSlots } from '../../hooks/useCalendar';
import Breadcrumb from '../../components/Breadcrumb';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function AssignSlotsModal({ faculty, year, month, onClose }) {
  const toast = useToast();
  const assign = useAssignSlots(year, month);
  const [slots, setSlots] = useState([{ duty_date: '', session_type: 'morning' }]);

  function addSlot() { setSlots((s) => [...s, { duty_date: '', session_type: 'morning' }]); }
  function updateSlot(i, k, v) { setSlots((s) => s.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function removeSlot(i) { setSlots((s) => s.filter((_, j) => j !== i)); }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await assign.mutateAsync({ facultyId: faculty.id, slots });
      toast({ message: `${res.data.created_count} slot(s) assigned.` });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <FormModal
      opened={!!faculty}
      onClose={onClose}
      title={`Assign Slots — ${faculty?.name}`}
      onSubmit={handleSubmit}
      submitLabel="Assign"
      loading={assign.isPending}
    >
      {slots.map((s, i) => (
        <div key={i} className="flex gap-2 items-end">
          <TextInput
            label={i === 0 ? 'Date' : ''}
            type="date"
            value={s.duty_date}
            onChange={(e) => updateSlot(i, 'duty_date', e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <Select
            label={i === 0 ? 'Session' : ''}
            value={s.session_type}
            onChange={(value) => updateSlot(i, 'session_type', value ?? 'morning')}
            data={[
              { value: 'morning',   label: 'Morning' },
              { value: 'afternoon', label: 'Afternoon' },
            ]}
            style={{ flex: 1 }}
          />
          {slots.length > 1 && (
            <Button type="button" variant="subtle" size="xs" onClick={() => removeSlot(i)}
              style={{ marginBottom: 1 }}>✕</Button>
          )}
        </div>
      ))}
      <Button type="button" variant="subtle" size="sm" onClick={addSlot}>+ Add slot</Button>
    </FormModal>
  );
}

function SetSessionsModal({ currentValue, onClose, onSave, loading }) {
  const [value, setValue] = useState(typeof currentValue === 'number' ? currentValue : 3);
  return (
    <FormModal
      opened
      onClose={onClose}
      title="Sessions Per Faculty"
      size="xs"
      onSubmit={(e) => { e.preventDefault(); onSave(typeof value === 'number' ? value : 3); }}
      submitLabel="Save"
      loading={loading}
    >
      <NumberInput
        label="Sessions per faculty"
        description="Duty slots each faculty must pick this month"
        min={1}
        max={20}
        allowDecimal={false}
        value={value}
        onChange={(v) => setValue(v)}
        required
      />
    </FormModal>
  );
}

export default function CalendarPage({ user }) {
  const toast = useToast();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showAssign,      setShowAssign]      = useState(null);
  const [closingWindow,   setClosingWindow]   = useState(false);
  const [showSetSessions, setShowSetSessions] = useState(false);

  const { data: config, isLoading } = useCalendar(year, month);
  const { data: unassigned }        = useUnassignedFaculty(year, month);

  const openWindow     = useOpenWindow(year, month);
  const closeWindow    = useCloseWindow(year, month);
  const updateDates    = useUpdateBlockedDates(year, month);
  const updateSessions = useUpdateSessionsPerFaculty(year, month);

  const blocked = Array.isArray(config?.blocked_dates) ? config.blocked_dates : [];

  function fmtDate(d) {
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function toggleBlocked(d) {
    const key = fmtDate(d);
    const updated = blocked.includes(key) ? blocked.filter(x => x !== key) : [...blocked, key];
    updateDates.mutate(updated, {
      onError: (err) => toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' }),
    });
  }

  async function handleOpen() {
    try { await openWindow.mutateAsync(); toast({ message: 'Window opened. Faculty notified via Telegram.' }); }
    catch (err) { toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' }); }
  }

  async function doClose() {
    try {
      await closeWindow.mutateAsync();
      toast({ message: 'Window closed.' });
      setClosingWindow(false);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  async function handleSetSessions(value) {
    try {
      await updateSessions.mutateAsync(value);
      toast({ message: 'Updated.' });
      setShowSetSessions(false);
    } catch {
      toast({ message: 'Failed.', type: 'error' });
    }
  }

  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);
  const leadingBlanks = Array.from({ length: new Date(year, month - 1, 1).getDay() });

  function goPrevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  }

  function goNextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  }

  function dayLabel(d) {
    const key = fmtDate(d);
    const isBlocked = blocked.includes(key);
    return `${new Date(year, month - 1, d).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${isBlocked ? ' — blocked' : ' — available'}`;
  }

  function dayButtonClass(d, { square = false } = {}) {
    const isBlocked = blocked.includes(fmtDate(d));
    return `${square ? 'w-10 h-10' : 'w-9 h-9'} rounded-lg text-sm font-medium transition-colors ${isBlocked ? 'bg-[var(--color-red-bg)] text-[var(--color-red-text)] border border-[var(--color-red-border)]' : 'bg-[var(--surface-page)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-page)]'}`;
  }

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Calendar' }]} />
      <PageHeader title="Duty Calendar" subtitle="Manage scheduling window and blocked dates" />

      {/* Month picker */}
      <div className="flex items-center gap-2 mb-6">
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
      </div>

      {isLoading ? <p className="text-[var(--text-muted)] text-[length:13px]">Loading…</p> : (
        <>
          {/* Status bar */}
          <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Window status</p>
                <Badge status={config?.is_window_open ? 'active' : 'inactive'} label={config?.is_window_open ? 'Open' : 'Closed'} />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Sessions per faculty</p>
                <p className="text-sm font-semibold">{config?.sessions_per_faculty ?? 3}</p>
              </div>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              {!config?.is_window_open
                ? <Button size="sm" onClick={handleOpen} loading={openWindow.isPending} className="flex-1 sm:flex-none">Open Window</Button>
                : <Button size="sm" color="red" onClick={() => setClosingWindow(true)} className="flex-1 sm:flex-none">Close Window</Button>}
              <Button size="sm" variant="default" onClick={() => setShowSetSessions(true)} className="flex-1 sm:flex-none">Set Sessions</Button>
            </div>
          </div>

          {/* Days grid */}
          <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Blocked dates (click to toggle)</p>
              <div className="hidden sm:flex items-center gap-2">
                <button type="button" onClick={goPrevMonth} aria-label="Previous month"
                  className="w-7 h-7 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-page)]">
                  ‹
                </button>
                <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[110px] text-center">{MONTHS[month - 1]} {year}</span>
                <button type="button" onClick={goNextMonth} aria-label="Next month"
                  className="w-7 h-7 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-page)]">
                  ›
                </button>
              </div>
            </div>

            {/* Mobile: flat wrapped list */}
            <div className="flex flex-wrap gap-2 sm:hidden">
              {days.map((d) => (
                <button key={d} onClick={() => toggleBlocked(d)}
                  aria-label={dayLabel(d)}
                  aria-pressed={blocked.includes(fmtDate(d))}
                  className={dayButtonClass(d)}>
                  {d}
                </button>
              ))}
            </div>

            {/* Desktop: traditional monthly calendar grid */}
            <div className="hidden sm:block max-w-[340px] mx-auto">
              <div className="grid grid-cols-7 gap-1 mb-1 justify-items-center">
                {WEEKDAYS.map((wd) => (
                  <div key={wd} className="text-center text-xs font-semibold text-[var(--text-muted)] py-1">{wd.slice(0, 2)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 justify-items-center">
                {leadingBlanks.map((_, i) => <div key={`blank-${i}`} />)}
                {days.map((d) => (
                  <button key={d} onClick={() => toggleBlocked(d)}
                    aria-label={dayLabel(d)}
                    aria-pressed={blocked.includes(fmtDate(d))}
                    className={dayButtonClass(d, { square: true })}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Calendar legend */}
          <div style={{
            marginTop: 16, padding: '14px 16px',
            backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-red-bg)', border: '1px solid var(--color-red-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--text-small)', color: 'var(--color-red-600)', fontWeight: 'var(--weight-bold)' }}>1</div>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Red — Blocked Date</span>
            </div>
          </div>

          {/* Unassigned faculty */}
          {unassigned?.data?.length > 0 && (
            <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-4 mt-6">
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Unassigned faculty ({unassigned.total})</p>
              <Table>
                <thead>
                  <tr><Th>Name</Th><Th>Dept.</Th><Th>Slots picked</Th><Th>Required</Th><Th /></tr>
                </thead>
                <tbody>
                  {unassigned.data.map((f) => (
                    <tr key={f.id}>
                      <Td className="font-medium">{f.name}</Td>
                      <Td>{f.department ?? '—'}</Td>
                      <Td>{f.slots_picked}</Td>
                      <Td>{f.slots_required}</Td>
                      <Td>
                        <Button size="xs" variant="default" onClick={() => setShowAssign(f)}>Assign Slots</Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}

      {showAssign && (
        <AssignSlotsModal
          faculty={showAssign}
          year={year} month={month}
          onClose={() => setShowAssign(null)}
        />
      )}

      {closingWindow && (
        <ConfirmDialog
          open
          title="Close Scheduling Window"
          message="Faculty will no longer be able to pick or change duty slots for this month."
          confirmText="Close Window"
          isDangerous
          isLoading={closeWindow.isPending}
          onConfirm={doClose}
          onCancel={() => setClosingWindow(false)}
        />
      )}

      {showSetSessions && (
        <SetSessionsModal
          currentValue={config?.sessions_per_faculty ?? 3}
          onClose={() => setShowSetSessions(false)}
          onSave={handleSetSessions}
          loading={updateSessions.isPending}
        />
      )}
    </Layout>
  );
}
