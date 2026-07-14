import { useState, useMemo } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import Breadcrumb from '../../components/Breadcrumb';
import { Table, Th, Td, EmptyRow, ErrorRow } from '../../components/ui/Table';
import { Button, Select } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ResolveFlagModal from '../../components/admin/ResolveFlagModal';
import { useFlaggedViolations } from '../../hooks/useReports';
import { useDeleteViolation } from '../../hooks/useViolations';
import { useToast } from '../../components/ui/Toast';

// Flagged violations carry the recorder in `faculty`; admins surface as "Admin".
function recorderName(faculty) {
  if (!faculty) return '—';
  return faculty.role === 'admin' || faculty.role === 'super_admin' ? 'Admin' : faculty.name;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

// Distinct, sorted option list for a Select filter, derived from the loaded rows.
function distinct(rows, pick) {
  const seen = new Map();
  for (const r of rows) {
    const [value, label] = pick(r);
    if (value != null && value !== '' && !seen.has(value)) seen.set(value, label ?? value);
  }
  return [...seen.entries()].map(([value, label]) => ({ value: String(value), label: String(label) }));
}

export default function FlaggedViolationsPage({ user }) {
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useFlaggedViolations();
  const deleteViolation = useDeleteViolation();

  const [resolving, setResolving] = useState(null);
  const [deleting,  setDeleting]  = useState(null);
  const [filters, setFilters] = useState({
    status: 'pending', duty_date: '', course: '', academic_year: '', recorder: '', violation_type: '',
  });

  const rows = data?.data ?? [];

  // Filter option lists come straight from the returned records so they only ever
  // offer values that actually exist in the flagged set.
  const options = useMemo(() => ({
    duty_date: distinct(rows, (v) => [v.dutySlot?.duty_date, fmtDate(v.dutySlot?.duty_date)]),
    course:    distinct(rows, (v) => [v.student?.course, v.student?.course]),
    academic_year: distinct(rows, (v) => [v.student?.academic_year, v.student?.academic_year]),
    recorder:  distinct(rows, (v) => [v.faculty ? recorderName(v.faculty) : null, v.faculty ? recorderName(v.faculty) : null]),
    violation_type: distinct(rows, (v) => [v.violationType?.name, v.violationType?.name]),
  }), [rows]);

  const filtered = useMemo(() => rows.filter((v) => {
    if (filters.status === 'pending'  && !v.is_flagged) return false;
    if (filters.status === 'reviewed' && !v.flag_resolved_at) return false;
    if (filters.duty_date && String(v.dutySlot?.duty_date ?? '') !== filters.duty_date) return false;
    if (filters.course && v.student?.course !== filters.course) return false;
    if (filters.academic_year && v.student?.academic_year !== filters.academic_year) return false;
    if (filters.recorder && recorderName(v.faculty) !== filters.recorder) return false;
    if (filters.violation_type && v.violationType?.name !== filters.violation_type) return false;
    return true;
  }), [rows, filters]);

  const pendingCount  = data?.pending_count  ?? rows.filter((v) => v.is_flagged).length;
  const resolvedCount = data?.resolved_count ?? rows.filter((v) => v.flag_resolved_at).length;

  async function handleDelete() {
    try {
      await deleteViolation.mutateAsync({ id: deleting.id });
      toast({ message: 'Student violation deleted.' });
      setDeleting(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value ?? '' }));
  }

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Flagged Violations' }]} />
      <PageHeader
        title="Flagged Student Violations"
        subtitle="Records faculty flagged for your review — resolve or remove them here"
      />

      {/* Status summary + filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select
          w={168}
          value={filters.status}
          onChange={(v) => setFilter('status', v ?? 'pending')}
          data={[
            { value: 'pending',  label: `Pending Review (${pendingCount})` },
            { value: 'reviewed', label: `Reviewed (${resolvedCount})` },
            { value: 'all',      label: `All (${rows.length})` },
          ]}
        />
        <Select w={150} placeholder="All dates"        clearable value={filters.duty_date || null}      onChange={(v) => setFilter('duty_date', v)}      data={options.duty_date} />
        <Select w={140} placeholder="All courses"      clearable value={filters.course || null}         onChange={(v) => setFilter('course', v)}         data={options.course} />
        <Select w={150} placeholder="All years"        clearable value={filters.academic_year || null}  onChange={(v) => setFilter('academic_year', v)}  data={options.academic_year} />
        <Select w={160} placeholder="All faculty"      clearable value={filters.recorder || null}       onChange={(v) => setFilter('recorder', v)}       data={options.recorder} />
        <Select w={180} placeholder="All violations"   clearable value={filters.violation_type || null} onChange={(v) => setFilter('violation_type', v)} data={options.violation_type} />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden" style={{ backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>Loading…</div>}
        {isError && <div style={{ padding: 24 }}><Button variant="subtle" size="xs" onClick={refetch}>Retry</Button></div>}
        {!isLoading && !isError && !filtered.length && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>No flagged violations.</div>}
        {filtered.map((v, i) => (
          <div key={v.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', backgroundColor: v.is_flagged ? 'var(--color-amber-bg)' : 'var(--surface-card)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p style={{ fontSize: 'var(--text-card-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(i + 1)}. {v.student?.student_name}
                </p>
                <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                  {v.student?.registration_number} • {v.student?.course}
                </p>
              </div>
              <Badge status={v.is_flagged ? 'flagged' : 'completed'} label={v.is_flagged ? '⚑ Pending' : 'Reviewed'} />
            </div>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 4 }}>{v.violationType?.name}</p>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)', marginTop: 2 }}>
              Faculty: {recorderName(v.faculty)} · Duty {fmtDate(v.dutySlot?.duty_date)} · Recorded {fmtDate(v.created_at)}
            </p>
            {v.flag_note && <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-secondary)', marginTop: 4 }}>Note: {v.flag_note}</p>}
            <div className="flex justify-end gap-1 mt-2">
              {v.is_flagged && !v.flag_resolved_at && (
                <Button variant="subtle" size="xs" onClick={() => setResolving(v)}>Mark as Reviewed</Button>
              )}
              <Button variant="subtle" size="xs" color="red" onClick={() => setDeleting(v)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>S.No</Th><Th>Student</Th><Th>Reg. No.</Th><Th>Course</Th><Th>Violation Type</Th>
              <Th>Faculty</Th><Th>Duty Date</Th><Th>Recorded</Th><Th>Flag Note</Th><Th>Status</Th><Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow cols={11} message="Loading…" />}
            {isError && <ErrorRow cols={11} onRetry={refetch} />}
            {!isLoading && !isError && !filtered.length && <EmptyRow cols={11} message="No flagged violations." />}
            {filtered.map((v, i) => (
              <tr key={v.id} className={v.is_flagged ? 'bg-[var(--color-amber-bg)]' : ''}>
                <Td>{i + 1}</Td>
                <Td className="font-medium text-[var(--text-primary)]">{v.student?.student_name}</Td>
                <Td className="font-mono text-[length:12px]">{v.student?.registration_number}</Td>
                <Td>{v.student?.course}</Td>
                <Td>
                  {v.violationType?.name}
                  {v.custom_violation && <p className="text-xs text-[var(--text-muted)]">{v.custom_violation}</p>}
                </Td>
                <Td>{recorderName(v.faculty)}</Td>
                <Td className="text-[length:12px]">{fmtDate(v.dutySlot?.duty_date)}</Td>
                <Td className="text-[length:12px]">{fmtDate(v.created_at)}</Td>
                <Td className="max-w-[220px] text-[length:12px] text-[var(--text-secondary)]">{v.flag_note || '—'}</Td>
                <Td><Badge status={v.is_flagged ? 'flagged' : 'completed'} label={v.is_flagged ? '⚑ Pending' : 'Reviewed'} /></Td>
                <Td>
                  <div className="flex gap-1">
                    {v.is_flagged && !v.flag_resolved_at && (
                      <Button variant="subtle" size="xs" onClick={() => setResolving(v)}>Mark as Reviewed</Button>
                    )}
                    <Button variant="subtle" size="xs" color="red" onClick={() => setDeleting(v)}>Delete</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Top-level modals — no parent modal to stack under, so the default z-index is fine */}
      {resolving && <ResolveFlagModal violation={resolving} onClose={() => setResolving(null)} />}
      {deleting && (
        <ConfirmDialog
          open
          title="Delete Student Violation"
          message={
            <>
              Are you sure you want to delete this student violation record? This cannot be undone from the app.
              <br /><br />
              <strong>Student:</strong> {deleting.student?.student_name}<br />
              <strong>Violation:</strong> {deleting.violationType?.name}<br />
              <strong>Date:</strong> {fmtDate(deleting.created_at)}
            </>
          }
          confirmText="Delete Permanently"
          isDangerous
          isLoading={deleteViolation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Layout>
  );
}
