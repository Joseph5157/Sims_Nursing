import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Table, Th, Td, EmptyRow, ErrorRow, ErrorBlock } from '../../components/ui/Table';
import { Button, Tooltip } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import ViolationTypeDrawer from '../../components/ViolationTypeDrawer';
import Breadcrumb from '../../components/Breadcrumb';
import { useViolationTypes, useDeactivateViolationType, useDeleteViolationType } from '../../hooks/useViolationTypes';

export default function ViolationTypesPage({ user }) {
  const toast = useToast();
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [showDeactivated, setShowDeact] = useState(false);

  const { data, isLoading, isError, refetch } = useViolationTypes(true);
  const deactivate = useDeactivateViolationType();
  const deleteType = useDeleteViolationType();

  async function handleDeactivate(t) {
    try {
      await deactivate.mutateAsync(t.id);
      toast({ message: 'Deactivated.' });
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  async function handleDelete(t) {
    if (!confirm(`Delete "${t.name}"?`)) return;
    try {
      await deleteType.mutateAsync(t.id);
      toast({ message: 'Deleted.' });
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  const allRows      = data?.data ?? [];
  const activeRows   = allRows.filter((t) => t.is_active);
  const inactiveRows = allRows.filter((t) => !t.is_active);

  function renderActions(t, size = 'xs') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          variant="subtle" size={size}
          aria-label={`Edit ${t.name}`}
          onClick={() => { setEditing(t); setShowModal(true); }}
        >
          Edit
        </Button>
        {t.is_active && (
          t.is_system ? null : (
            <Button
              variant="subtle" color="gray" size={size}
              aria-label={`Deactivate ${t.name}`}
              onClick={() => handleDeactivate(t)}
            >
              Deactivate
            </Button>
          )
        )}
        {t.is_system ? (
          <Tooltip label="System types cannot be deleted" withArrow position="top">
            <Button
              variant="subtle" color="red" size={size}
              aria-label={`Delete ${t.name} (system type — cannot be deleted)`}
              disabled
              style={{ pointerEvents: 'all' }}
            >
              Delete
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="subtle" color="red" size={size}
            aria-label={`Delete ${t.name}`}
            onClick={() => handleDelete(t)}
          >
            Delete
          </Button>
        )}
      </div>
    );
  }

  function renderMobileCard(t, i) {
    return (
      <div key={t.id} style={{
        background: 'var(--surface-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: 14,
        opacity: t.is_active ? 1 : 0.65,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 'var(--text-card)', color: 'var(--text-muted)', fontWeight: 600 }}>#{i + 1}</p>
            <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</p>
            <p style={{ fontSize: 'var(--text-card)', color: 'var(--text-secondary)', marginTop: 2 }}>Default fine: <strong>₹{t.default_fine}</strong></p>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Badge status={t.is_active ? 'active' : 'inactive'} />
            {t.is_system && <Badge status="pending" label="System" />}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {renderActions(t)}
        </div>
      </div>
    );
  }

  function renderTableRow(t, i) {
    return (
      <tr key={t.id} style={{ opacity: t.is_active ? 1 : 0.6 }}>
        <Td>{i + 1}</Td>
        <Td className="font-medium">{t.name}</Td>
        <Td>₹{t.default_fine}</Td>
        <Td><Badge status={t.is_active ? 'active' : 'inactive'} /></Td>
        <Td>{t.is_system && <Badge status="pending" label="System" />}</Td>
        <Td>{renderActions(t)}</Td>
      </tr>
    );
  }

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Student Violation Types' }]} />
      <PageHeader
        title="Student Violation Types"
        subtitle="Define disciplinary categories and default fines"
        action={<Button size="md" onClick={() => { setEditing(null); setShowModal(true); }}>+ New Type</Button>}
      />

      {/* Mobile card list */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isLoading && <p style={{ fontSize: 'var(--text-card)', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Loading…</p>}
        {isError && <ErrorBlock onRetry={refetch} />}
        {!isLoading && !isError && !activeRows.length && (
          <div style={{ padding: '24px 16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <p style={{ fontSize: 'var(--text-card)', color: 'var(--text-muted)' }}>No student violation types yet.</p>
          </div>
        )}
        {activeRows.map((t, i) => renderMobileCard(t, i))}

        {inactiveRows.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowDeact((s) => !s)}
              style={{
                fontSize: 'var(--text-small)', color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 0', fontWeight: 600,
              }}
            >
              {showDeactivated ? '▲ Hide' : '▼ Show'} deactivated ({inactiveRows.length})
            </button>
            {showDeactivated && inactiveRows.map((t, i) => renderMobileCard(t, i))}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr><Th>S.No</Th><Th>Name</Th><Th>Default Fine (₹)</Th><Th>Status</Th><Th>System</Th><Th /></tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow cols={6} message="Loading…" />}
            {isError && <ErrorRow cols={6} onRetry={refetch} />}
            {!isLoading && !isError && !activeRows.length && <EmptyRow cols={6} message="No student violation types yet." />}
            {activeRows.map((t, i) => renderTableRow(t, i))}
          </tbody>
        </Table>

        {inactiveRows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowDeact((s) => !s)}
              style={{
                fontSize: 'var(--text-small)', color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 0', fontWeight: 600,
              }}
            >
              {showDeactivated ? '▲ Hide' : '▼ Show'} deactivated types ({inactiveRows.length})
            </button>
            {showDeactivated && (
              <Table style={{ marginTop: 8 }}>
                <thead>
                  <tr><Th>S.No</Th><Th>Name</Th><Th>Default Fine (₹)</Th><Th>Status</Th><Th>System</Th><Th /></tr>
                </thead>
                <tbody>
                  {inactiveRows.map((t, i) => renderTableRow(t, i))}
                </tbody>
              </Table>
            )}
          </div>
        )}
      </div>

      <ViolationTypeDrawer open={showModal} editing={editing} onClose={() => { setShowModal(false); setEditing(null); }} />
    </Layout>
  );
}
