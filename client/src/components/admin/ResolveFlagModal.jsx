import { useState } from 'react';
import { TextInput } from '@mantine/core';
import FormModal from '../ui/FormModal';
import { useToast } from '../ui/Toast';
import { useResolveFlag } from '../../hooks/useViolations';

// Single home for the flag-resolution flow — used only by the Flagged Violations
// page, the one place flags are reviewed. (It previously lived in ViolationsPage
// and was imported from there, leaving two full pages able to resolve flags.)
export default function ResolveFlagModal({ violation, onClose, zIndex }) {
  const toast = useToast();
  const resolve = useResolveFlag();
  const [reason, setReason] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await resolve.mutateAsync({ id: violation.id, reason });
      toast({ message: 'Flag resolved.' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  return (
    <FormModal
      opened={!!violation}
      onClose={onClose}
      title="Resolve Flag"
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Resolve"
      loading={resolve.isPending}
      zIndex={zIndex}
    >
      <div className="text-[length:13px] text-[var(--text-secondary)] rounded-lg p-3"
        style={{ backgroundColor: 'var(--color-amber-bg)', border: '1px solid var(--color-amber-border)' }}>
        <strong>Flag note:</strong> {violation?.flag_note}
      </div>
      <TextInput
        label="Resolution note"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />
    </FormModal>
  );
}
