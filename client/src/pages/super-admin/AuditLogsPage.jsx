import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Table, Th, Td, EmptyRow, ErrorRow, ErrorBlock } from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import { TextInput } from '@mantine/core';
import { useAuditLogs } from '../../hooks/useUsers';

export default function AuditLogsPage({ user }) {
  const [page,   setPage]   = useState(1);
  const [action, setAction] = useState('');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');

  const { data, isLoading, isError, refetch } = useAuditLogs({ action, from, to, page, limit: 50 });

  function getActionColor(act) {
    if (!act) return 'var(--text-muted)';
    if (act.includes('DELETE') || act.includes('DEACTIVATE')) return 'var(--color-red-solid)';
    if (act.includes('CREATE') || act.includes('UPLOAD'))     return 'var(--color-emerald-solid)';
    if (act.includes('RESET'))                                return 'var(--color-amber-solid)';
    if (act.includes('UPDATE') || act.includes('EDIT'))       return 'var(--color-blue-500)';
    return 'var(--text-muted)';
  }

  return (
    <Layout user={user}>
      <PageHeader title="Audit Logs" subtitle="Immutable system-level action history" />

      <div className="mb-4 flex gap-2 flex-wrap items-end">
        <TextInput
          placeholder="Filter by action…"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          w={256}
        />
        <TextInput
          type="date"
          label="From"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          w={160}
        />
        <TextInput
          type="date"
          label="To"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1); }}
          w={160}
        />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden" style={{
        backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)',
        border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16,
      }}>
        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>Loading…</div>}
        {isError && <ErrorBlock onRetry={refetch} />}
        {!isLoading && !isError && !data?.data?.length && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>No logs found.</div>}
        {data?.data?.map((log) => (
          <div key={log.id} style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface-card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{
                fontSize: 'var(--text-small)', fontWeight: 'var(--weight-bold)', color: 'var(--text-on-brand)',
                backgroundColor: getActionColor(log.action),
                padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)',
              }}>
                {log.action?.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>
                {new Date(log.created_at).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-card)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 2 }}>
              {log.actor?.name ?? 'System'}
            </p>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
              {log.target_type} · {log.target_id?.slice(0, 8)}…
            </p>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Timestamp</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow cols={4} message="Loading…" />}
            {isError && <ErrorRow cols={4} onRetry={refetch} />}
            {!isLoading && !isError && !data?.data?.length && <EmptyRow cols={4} />}
            {data?.data?.map((log) => (
              <tr key={log.id}>
                <Td className="font-medium">{log.actor?.name ?? log.actor_id}</Td>
                <Td>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)',
                    backgroundColor: 'var(--color-slate-100)', color: 'var(--color-slate-600)',
                    padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                  }}>
                    {log.action}
                  </span>
                </Td>
                <Td style={{ fontSize: 'var(--text-micro)', color: 'var(--color-slate-500)' }}>
                  {log.target_type} {log.target_id ? `· ${log.target_id.slice(0, 8)}…` : ''}
                </Td>
                <Td style={{ fontSize: 'var(--text-micro)', color: 'var(--color-slate-400)' }}>
                  {new Date(log.created_at).toLocaleString()}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Pagination meta={data?.meta} page={page} onPage={setPage} />
    </Layout>
  );
}
