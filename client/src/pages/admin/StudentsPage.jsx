import { useState, useEffect } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import Breadcrumb from '../../components/Breadcrumb';
import { Table, Th, Td, Tr, EmptyRow, ErrorRow, ErrorBlock } from '../../components/ui/Table';
import { Button, Select, Checkbox } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import FormModal from '../../components/ui/FormModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { CardSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton';
import UploadStudentsDrawer from '../../components/UploadStudentsDrawer';
import StudentDetailsDrawer from '../../components/StudentDetailsDrawer';
import { useDebounce } from '../../hooks/useDebounce';
import {
  useStudents, usePromoteStudent, useDeleteStudent,
  useBulkPromoteStudents, useBulkDeleteStudents,
} from '../../hooks/useStudents';
import { ROUTES } from '../../utils/constants';

const COURSE_LABELS = { b_pharm: 'B.Pharm', pharm_d: 'Pharm.D', m_pharm: 'M.Pharm' };

const YEAR_OPTIONS = [
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
  { value: '5', label: 'Year 5' },
  { value: '6', label: 'Year 6' },
];

const SEMESTER_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Semester ${i + 1}`,
}));

function PromoteModal({ open, student, onClose }) {
  const toast   = useToast();
  const promote = usePromoteStudent();
  const [form, setForm] = useState({
    year:          String(student?.year ?? 1),
    semester:      String(student?.semester ?? 1),
    academic_year: '',
  });

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await promote.mutateAsync({
        id:            student.id,
        year:          parseInt(form.year, 10),
        semester:      parseInt(form.semester, 10),
        academic_year: form.academic_year || undefined,
      });
      toast({ message: 'Student promoted.' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <FormModal
      opened={open}
      onClose={onClose}
      title={`Promote — ${student?.student_name}`}
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Promote"
      loading={promote.isPending}
    >
      <Select
        label="Year"
        data={YEAR_OPTIONS}
        value={form.year}
        onChange={(v) => setForm((f) => ({ ...f, year: v }))}
        required
      />
      <Select
        label="Semester"
        data={SEMESTER_OPTIONS}
        value={form.semester}
        onChange={(v) => setForm((f) => ({ ...f, semester: v }))}
        required
        mt="sm"
      />
      <input
        placeholder="Academic Year e.g. 2025-26 (optional)"
        value={form.academic_year}
        onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
        style={{
          marginTop: 12, width: '100%', padding: '8px 12px',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          fontSize: 16,
        }}
      />
    </FormModal>
  );
}

function BulkPromoteModal({ open, ids, onClose, onDone }) {
  const toast   = useToast();
  const promote = useBulkPromoteStudents();
  const [form, setForm] = useState({ year: '1', semester: '1', academic_year: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await promote.mutateAsync({
        ids,
        year:          parseInt(form.year, 10),
        semester:      parseInt(form.semester, 10),
        academic_year: form.academic_year || undefined,
      });
      toast({ message: `Promoted ${res.data.updated} student${res.data.updated === 1 ? '' : 's'}.` });
      onDone();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <FormModal
      opened={open}
      onClose={onClose}
      title={`Promote ${ids.length} student${ids.length === 1 ? '' : 's'}`}
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Promote"
      loading={promote.isPending}
    >
      <Select
        label="Year"
        data={YEAR_OPTIONS}
        value={form.year}
        onChange={(v) => setForm((f) => ({ ...f, year: v }))}
        required
      />
      <Select
        label="Semester"
        data={SEMESTER_OPTIONS}
        value={form.semester}
        onChange={(v) => setForm((f) => ({ ...f, semester: v }))}
        required
        mt="sm"
      />
      <input
        placeholder="Academic Year e.g. 2025-26 (optional)"
        value={form.academic_year}
        onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
        style={{
          marginTop: 12, width: '100%', padding: '8px 12px',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          fontSize: 16,
        }}
      />
    </FormModal>
  );
}

export default function StudentsPage({ user }) {
  const toast = useToast();
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [filterCourse,  setFilterCourse]  = useState('');
  const [filterYear,    setFilterYear]    = useState('');
  const [showUpload, setShowUpload]       = useState(false);
  const [promoting, setPromoting]         = useState(null);
  const [deleting, setDeleting]           = useState(null);
  const [viewingId, setViewingId]         = useState(null);
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [showBulkPromote, setShowBulkPromote] = useState(false);
  const [bulkDeleting, setBulkDeleting]       = useState(false);

  const debouncedSearch = useDebounce(search, 500);
  const { data, isLoading, isError, refetch } = useStudents({
    search:  debouncedSearch,
    course:  filterCourse  || undefined,
    year:    filterYear    || undefined,
    page,
    limit:   20,
  });
  const deleteStudent  = useDeleteStudent();
  const bulkDelete     = useBulkDeleteStudents();

  // Selection is page-scoped — clear it whenever the visible row set changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filterCourse, filterYear, debouncedSearch]);

  const pageIds     = (data?.data ?? []).map((s) => s.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = pageIds.some((id) => selectedIds.has(id));

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function resetFilters() {
    setFilterCourse(''); setFilterYear('');
    setSearch(''); setPage(1);
  }

  async function handleDelete() {
    try {
      await deleteStudent.mutateAsync(deleting.id);
      toast({ message: 'Student permanently deleted.' });
      setDeleting(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
      setDeleting(null);
    }
  }

  async function handleBulkDelete() {
    try {
      const res = await bulkDelete.mutateAsync(Array.from(selectedIds));
      const { deleted, skipped = [] } = res.data;
      const withRecords = skipped.filter((s) => s.reason === 'has disciplinary records').length;
      let message = `Permanently deleted ${deleted} student${deleted === 1 ? '' : 's'}.`;
      if (withRecords > 0) {
        message += ` ${withRecords} skipped — kept for their disciplinary records.`;
      }
      toast({ message, type: withRecords > 0 ? 'info' : 'success' });
      clearSelection();
      setBulkDeleting(false);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
      setBulkDeleting(false);
    }
  }

  const hasFilters = filterCourse || filterYear || search;

  return (
    <Layout user={user}>
      <Breadcrumb items={[
        { label: 'Admin', href: ROUTES.ADMIN_DASHBOARD },
        { label: 'Students' },
      ]} />
      <PageHeader
        title="Student Management"
        subtitle="Upload Excel to sync student records"
        action={<Button size="md" onClick={() => setShowUpload(true)}>↑ Upload Excel</Button>}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          placeholder="Search name or reg. no…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            flex: '1 1 180px', minWidth: 160,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            padding: '7px 12px', fontSize: 16,
            backgroundColor: 'var(--surface-card)',
          }}
        />
        <select
          value={filterCourse}
          onChange={(e) => { setFilterCourse(e.target.value); setPage(1); }}
          style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '7px 10px', fontSize: 16, backgroundColor: 'var(--surface-card)', color: filterCourse ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <option value="">All courses</option>
          <option value="b_pharm">B.Pharm</option>
          <option value="pharm_d">Pharm.D</option>
          <option value="m_pharm">M.Pharm</option>
        </select>
        <select
          value={filterYear}
          onChange={(e) => { setFilterYear(e.target.value); setPage(1); }}
          style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '7px 10px', fontSize: 16, backgroundColor: 'var(--surface-card)', color: filterYear ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <option value="">All years</option>
          {[1,2,3,4,5,6].map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        {hasFilters && (
          <button onClick={resetFilters} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontWeight: 600 }}>
            Clear
          </button>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden" style={{ backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        {!isLoading && !isError && data?.data?.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface-page)',
          }}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={toggleSelectAll}
            />
            <span style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {allSelected ? `All ${pageIds.length} selected` : `Select all (${pageIds.length})`}
            </span>
          </div>
        )}
        {isLoading && Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        {isError && <ErrorBlock onRetry={refetch} />}
        {!isLoading && !isError && !data?.data?.length && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>No students found.</div>
        )}
        {data?.data?.map((s) => (
          <div key={s.id} style={{
            padding: '14px 16px', backgroundColor: 'var(--surface-card)',
            borderBottom: '1px solid var(--border)',
          }}>
            <div
              onClick={() => setViewingId(s.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setViewingId(s.id);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, cursor: 'pointer',
              }}
            >
              <span onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
                <Checkbox checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 'var(--text-card-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.student_name}
                </p>
                <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                  {s.registration_number} · {COURSE_LABELS[s.course] ?? s.course} · Yr {s.year}, Sem {s.semester}
                </p>
              </div>
              <Badge status={s.status} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <Button variant="subtle" size="xs" onClick={() => setPromoting(s)}>Promote</Button>
              <Button variant="subtle" size="xs" color="red" onClick={() => setDeleting(s)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={toggleSelectAll}
                />
              </Th>
              <Th>Reg. No.</Th>
              <Th>Name</Th>
              <Th>Course</Th>
              <Th>Year</Th>
              <Th>Semester</Th>
              <Th>Batch</Th>
              <Th>Acad. Year</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} cols={9} />)}
            {isError && <ErrorRow cols={9} onRetry={refetch} />}
            {!isLoading && !isError && !data?.data?.length && <EmptyRow cols={9} />}
            {data?.data?.map((s) => (
              <Tr key={s.id} onClick={() => setViewingId(s.id)}>
                <Td>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                  </span>
                </Td>
                <Td className="font-mono text-xs">{s.registration_number}</Td>
                <Td className="font-medium text-[var(--text-primary)]">{s.student_name}</Td>
                <Td>{COURSE_LABELS[s.course] ?? s.course}</Td>
                <Td>{s.year}</Td>
                <Td>{s.semester}</Td>
                <Td>{s.batch_year}</Td>
                <Td>{s.academic_year}</Td>
                <Td><Badge status={s.status} /></Td>
                <Td>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="subtle" size="xs" onClick={() => setPromoting(s)}>Promote</Button>
                    <Button variant="subtle" size="xs" color="red" onClick={() => setDeleting(s)}>Delete</Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div style={{
        marginTop: 16, padding: '12px 16px',
        backgroundColor: 'var(--surface-page)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Total students</span>
        <span style={{ fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
          {data?.meta?.total ?? 0}
        </span>
      </div>

      <Pagination meta={data?.meta} page={page} onPage={setPage} />
      {selectedIds.size > 0 && <div style={{ height: 64 }} />}

      {selectedIds.size > 0 && (
        <div
          className="fixed left-0 right-0 z-40 bottom-[60px] sm:bottom-0"
          style={{
            backgroundColor: 'var(--surface-card)', borderTop: '1px solid var(--border)',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
            padding: '10px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 'var(--text-card)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedIds.size} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="subtle" size="sm" onClick={clearSelection}>Clear</Button>
            <Button variant="light" size="sm" onClick={() => setShowBulkPromote(true)}>Bulk Promote</Button>
            <Button variant="light" color="red" size="sm" onClick={() => setBulkDeleting(true)}>Bulk Delete</Button>
          </div>
        </div>
      )}

      <UploadStudentsDrawer open={showUpload} onClose={() => setShowUpload(false)} />
      <StudentDetailsDrawer studentId={viewingId} onClose={() => setViewingId(null)} />
      {promoting && <PromoteModal open student={promoting} onClose={() => setPromoting(null)} />}
      {deleting && (
        <ConfirmDialog
          open
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          title="Delete Student"
          message={`Are you sure you want to permanently delete ${deleting.student_name}? This action cannot be undone.`}
          confirmText="Delete"
          isDangerous
          isLoading={deleteStudent.isPending}
        />
      )}
      {showBulkPromote && (
        <BulkPromoteModal
          open
          ids={Array.from(selectedIds)}
          onClose={() => setShowBulkPromote(false)}
          onDone={() => { setShowBulkPromote(false); clearSelection(); }}
        />
      )}
      {bulkDeleting && (
        <ConfirmDialog
          open
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleting(false)}
          title="Delete Students"
          message={`Are you sure you want to permanently delete the selected ${selectedIds.size} student${selectedIds.size === 1 ? '' : 's'}? This action cannot be undone.`}
          confirmText="Delete"
          isDangerous
          isLoading={bulkDelete.isPending}
        />
      )}
    </Layout>
  );
}
