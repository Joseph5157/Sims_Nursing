import { useState, useEffect } from 'react';
import { TextInput, NumberInput } from '@mantine/core';
import BottomDrawer, { DrawerSpinner, cancelBtnStyle, primaryBtnStyle } from './ui/BottomDrawer';
import { useCreateViolationType, useUpdateViolationType } from '../hooks/useViolationTypes';
import { useToast } from './ui/Toast';

export default function ViolationTypeDrawer({ open, editing, onClose }) {
  const toast = useToast();
  const create = useCreateViolationType();
  const update = useUpdateViolationType();
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    default_fine: editing?.default_fine ?? '',
  });

  useEffect(() => {
    setForm({
      name: editing?.name ?? '',
      default_fine: editing?.default_fine ?? '',
    });
  }, [editing?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { name: form.name, default_fine: parseFloat(form.default_fine) };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast({ message: 'Updated.' });
      } else {
        await create.mutateAsync(payload);
        toast({ message: 'Student violation type created.' });
      }
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  const isPending = create.isPending || update.isPending;
  const canSubmit = form.name.trim() && form.default_fine !== '';

  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      title={editing ? 'Edit student violation type' : 'New student violation type'}
      subtitle={editing ? 'Update name or fine amount' : 'Define a new disciplinary category'}
      footer={
        <>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          <button
            type="submit"
            form="vtype-form"
            disabled={isPending || !canSubmit}
            data-primary=""
            style={primaryBtnStyle(isPending || !canSubmit)}
          >
            {isPending && <DrawerSpinner />}
            {isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <form id="vtype-form" onSubmit={handleSubmit} style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{
          fontSize: 'var(--text-micro)', fontWeight: 800, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: -4,
        }}>Details</p>
        <TextInput
          label="Name"
          placeholder="Late arrival"
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />
        <NumberInput
          label="Default fine (₹)"
          leftSection={<span style={{ fontSize: 'var(--text-card)', fontWeight: 600, color: 'var(--text-secondary)' }}>₹</span>}
          min={0}
          decimalScale={2}
          placeholder="0.00"
          value={form.default_fine === '' ? '' : Number(form.default_fine)}
          onChange={(value) => setForm(f => ({ ...f, default_fine: value }))}
        />
      </form>
    </BottomDrawer>
  );
}
