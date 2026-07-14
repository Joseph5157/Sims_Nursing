import { useState } from 'react';
import { Table, Th, Td, EmptyRow } from '../ui/Table';
import { Button, TextInput, Select } from '@mantine/core';
import Badge from '../ui/Badge';
import FormModal from '../ui/FormModal';
import Pagination from '../ui/Pagination';
import { useToast } from '../ui/Toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useMyViolations, useFlagViolation, useDeleteViolation } from '../../hooks/useViolations';
import { useMyDutyDates } from '../../hooks/useDutySlots';
import api from '../../utils/api';

function FlagModal({ violation, onClose }) {
  const toast = useToast();
  const flag = useFlagViolation();
  const [note, setNote] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await flag.mutateAsync({ id: violation.id, flag_note: note });
      toast({ message: 'Student violation flagged for review.' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <FormModal
      opened={!!violation}
      onClose={onClose}
      title="Flag for Review"
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Flag"
      loading={flag.isPending}
    >
      <TextInput
        label="Reason for flagging"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        required
      />
    </FormModal>
  );
}

function dutyDateOptionLabel(slot) {
  const date = new Date(slot.duty_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const session = slot.session_type === 'morning' ? 'Morning' : 'Afternoon';
  return `${date} – ${session} Session`;
}

// The duty-date filter, PDF export, and detailed violations table shared by the
// dedicated Student Violations page (ViolationRecorderPage.jsx) and the
// Dashboard's "My Violations" section — one implementation so the two can never
// drift apart. Self-contained: manages its own filter/pagination/modal state and
// reads from the same `myViolations` React Query cache both call sites share, so
// a create/flag/delete/resolve anywhere invalidates both automatically.
export default function MyViolationsTable() {
  const [page, setPage]             = useState(1);
  const [flagging,   setFlagging]   = useState(null);
  const [deleting,   setDeleting]   = useState(null);
  const [dutySlotId, setDutySlotId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  const { data: dutyDatesData } = useMyDutyDates();
  const dutyDateOptions = (dutyDatesData?.data ?? []).map((slot) => ({
    value: slot.id,
    label: dutyDateOptionLabel(slot),
  }));

  const { data, isLoading } = useMyViolations({ page, limit: 20, ...(dutySlotId && { duty_slot_id: dutySlotId }) });
  const deleteViolation = useDeleteViolation();

  function handleDutyDateChange(value) {
    setDutySlotId(value);
    setPage(1);
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const res = await api.get('/violations/my/pdf', { params: { duty_slot_id: dutySlotId }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student-violations.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: 'Could not download report.', type: 'error' });
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteViolation.mutateAsync({ id: deleting.id });
      toast({ message: 'Student violation deleted.' });
      setDeleting(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Select
          label="Select Duty Date"
          placeholder="All duty dates"
          data={dutyDateOptions}
          value={dutySlotId}
          onChange={handleDutyDateChange}
          clearable
          searchable
          className="w-full sm:w-80"
        />
        <Button
          variant="light"
          disabled={!dutySlotId || downloading}
          loading={downloading}
          onClick={handleDownloadPdf}
        >
          Download PDF Report
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>S.No</Th><Th>Student</Th><Th>Course</Th><Th>Type</Th><Th>Fine</Th><Th>Date</Th><Th>Status</Th><Th />
          </tr>
        </thead>
        <tbody>
          {isLoading && <EmptyRow cols={8} message="Loading…" />}
          {!isLoading && !data?.data?.length && <EmptyRow cols={8} message="No student violations recorded." />}
          {data?.data?.map((v, i) => (
            <tr key={v.id}>
              <Td>{(page - 1) * 20 + i + 1}</Td>
              <Td>
                <p className="font-medium">{v.student?.student_name}</p>
                <p className="text-xs text-[var(--text-muted)]">{v.student?.registration_number}</p>
              </Td>
              <Td>{v.student?.course ?? '—'}</Td>
              <Td>{v.violationType?.name}</Td>
              <Td>{v.is_warning_only ? <span className="text-xs text-[var(--text-muted)]">Warning</span> : `₹${v.fine_amount}`}</Td>
              <Td className="text-xs">{new Date(v.created_at).toLocaleDateString('en-IN')}</Td>
              <Td>
                {v.is_flagged ? <Badge status="pending" label="Flagged" /> : <Badge status={v.record_status} />}
              </Td>
              <Td>
                <div className="flex gap-2">
                  {!v.is_flagged && v.record_status === 'active' && (
                    <Button variant="subtle" size="xs" onClick={() => setFlagging(v)}>Flag</Button>
                  )}
                  <Button variant="subtle" size="xs" color="red" onClick={() => setDeleting(v)}>Delete</Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination meta={data?.meta} page={page} onPage={setPage} />
      {flagging && <FlagModal violation={flagging} onClose={() => setFlagging(null)} />}
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
              <strong>Date:</strong> {new Date(deleting.created_at).toLocaleDateString('en-IN')}
            </>
          }
          confirmText="Delete Permanently"
          isDangerous
          isLoading={deleteViolation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
