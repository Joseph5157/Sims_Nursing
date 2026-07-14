import { useState, useMemo } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Table, Th, Td, EmptyRow, ErrorRow } from '../../components/ui/Table';
import { TextInput, Select } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import { useAllFacultyDuties } from '../../hooks/useDutySlots';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function sessionLabel(s) {
  return s === 'morning' ? 'Morning' : s === 'afternoon' ? 'Afternoon' : (s ?? '—');
}

// The latest reassignment (if any) — SLOT_SELECT returns it as a 1-element array.
function reassignment(slot) {
  return slot.reassignments?.[0] ?? null;
}

export default function AllFacultyDutiesPage({ user }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch]   = useState('');
  const [session, setSession] = useState('');

  const { data, isLoading, isError, refetch } = useAllFacultyDuties(year, month);
  const slots = data?.data ?? [];

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return slots.filter((s) => {
      if (session && s.session_type !== session) return false;
      if (q) {
        const r = reassignment(s);
        const haystack = [
          s.faculty?.name, s.faculty?.department,
          r?.fromFaculty?.name, r?.toFaculty?.name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [slots, search, session]);

  return (
    <Layout user={user}>
      <PageHeader
        title="All Faculty Duties"
        subtitle="Every booked duty this month — see who is on duty when to plan reassignments"
      />

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} aria-label="Previous month"
          className="w-11 h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-page)] text-[var(--text-secondary)] flex items-center justify-center text-base">‹</button>
        <p className="font-bold text-[15px] text-[var(--text-primary)]">{MONTH_NAMES[month - 1]} {year}</p>
        <button onClick={nextMonth} aria-label="Next month"
          className="w-11 h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-page)] text-[var(--text-secondary)] flex items-center justify-center text-base">›</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <TextInput
          w={240}
          placeholder="Search faculty or department"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <Select
          w={160}
          placeholder="All sessions"
          clearable
          value={session || null}
          onChange={(v) => setSession(v ?? '')}
          data={[
            { value: 'morning',   label: 'Morning' },
            { value: 'afternoon', label: 'Afternoon' },
          ]}
        />
        <span className="text-[length:12px] text-[var(--text-muted)]">
          {filtered.length} {filtered.length === 1 ? 'duty' : 'duties'}
        </span>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden" style={{ backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>Loading…</div>}
        {isError && <div style={{ padding: 24, textAlign: 'center' }}><button onClick={refetch} className="text-[var(--brand)] text-[length:13px] font-semibold">Retry</button></div>}
        {!isLoading && !isError && !filtered.length && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>No booked duties this month.</div>}
        {filtered.map((s) => {
          const r = reassignment(s);
          return (
            <div key={s.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p style={{ fontSize: 'var(--text-card-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.faculty?.name}
                  </p>
                  <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>{s.faculty?.department ?? '—'}</p>
                </div>
                <Badge status={s.status} />
              </div>
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 4 }}>
                {fmtDate(s.duty_date)} · {sessionLabel(s.session_type)}
              </p>
              {r && (
                <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-indigo-text)', marginTop: 4, fontWeight: 600 }}>
                  Reassigned: {r.fromFaculty?.name} → {r.toFaculty?.name}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Faculty</Th><Th>Department</Th><Th>Duty Date</Th><Th>Session</Th><Th>Status</Th><Th>Reassignment</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow cols={6} message="Loading…" />}
            {isError && <ErrorRow cols={6} onRetry={refetch} />}
            {!isLoading && !isError && !filtered.length && <EmptyRow cols={6} message="No booked duties this month." />}
            {filtered.map((s) => {
              const r = reassignment(s);
              return (
                <tr key={s.id}>
                  <Td className="font-medium text-[var(--text-primary)]">{s.faculty?.name}</Td>
                  <Td>{s.faculty?.department ?? '—'}</Td>
                  <Td className="text-[length:12px]">{fmtDate(s.duty_date)}</Td>
                  <Td>{sessionLabel(s.session_type)}</Td>
                  <Td><Badge status={s.status} /></Td>
                  <Td>
                    {r ? (
                      <span className="text-[length:12px] text-[var(--color-indigo-text)] font-medium">
                        {r.fromFaculty?.name} → {r.toFaculty?.name}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </Layout>
  );
}
