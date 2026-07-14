import { useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import { Button } from '@mantine/core';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import ComposeDrawer from '../../components/ComposeDrawer';
import { useInbox, useSent, useMessage, useDeleteMessage } from '../../hooks/useMessages';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Thread panel ──────────────────────────────────────────────────────────────
function ThreadPanel({ messageId, currentUser, onClose }) {
  const { data, isError, refetch } = useMessage(messageId);
  const deleteMsg = useDeleteMessage();
  const toast     = useToast();

  async function handleDelete() {
    if (!confirm('Delete this message?')) return;
    try {
      await deleteMsg.mutateAsync(messageId);
      toast({ message: 'Message deleted.' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  if (isError) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[length:13px] text-[var(--text-muted)] w-full">
      <p>Couldn't load this message.</p>
      <Button size="xs" variant="light" color="red" onClick={refetch}>Retry</Button>
    </div>
  );

  if (!data) return (
    <div className="flex-1 flex items-center justify-center text-[length:13px] text-[var(--text-muted)] w-full">
      Loading…
    </div>
  );

  const isSent = data.sender?.id === currentUser?.id;

  return (
    <div className="flex-1 flex flex-col min-w-0 w-full sm:border-l sm:border-[var(--border)]">
      {/* Header — back button on mobile, close ✕ on desktop */}
      <div className="px-4 sm:px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
        {/* Mobile back button */}
        <button
          onClick={onClose}
          className="sm:hidden flex items-center gap-1 text-[length:13px] text-[var(--brand)] font-medium mr-1"
          aria-label="Back to messages"
        >
          ← Back
        </button>

        {/* Subject + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-[length:14px] font-semibold text-[var(--text-primary)] truncate">{data.subject}</p>
          <p className="text-[length:11px] text-[var(--text-muted)] mt-0.5">
            {isSent ? `To: ${data.receiver?.name}` : `From: ${data.sender?.name}`}
            {' · '}{fmtDate(data.created_at)}
          </p>
        </div>

        {/* Desktop close */}
        <button onClick={onClose} className="hidden sm:block text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-[length:18px] leading-none flex-shrink-0">
          ✕
        </button>
      </div>

      {/* Message bubble */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5">
        <div className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
            isSent
              ? 'bg-[var(--brand)] text-[var(--text-on-brand)] rounded-br-sm'
              : 'bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-sm'
          }`}>
            <p style={{
              fontSize: 'var(--text-small)', fontWeight: 600,
              color: isSent ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)',
              marginBottom: 2,
            }}>
              {isSent ? 'You' : data.sender?.name}
            </p>
            <p className="text-[length:13px] whitespace-pre-wrap leading-relaxed">{data.body}</p>
            <p style={{
              fontSize: 'var(--text-micro)',
              color: isSent ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)',
              marginTop: 4,
            }}>
              {new Date(data.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-[var(--border)] flex justify-end">
        <Button color="red" size="sm" onClick={handleDelete} loading={deleteMsg.isPending}>
          Delete
        </Button>
      </div>
    </div>
  );
}

// ── Message list item ─────────────────────────────────────────────────────────
function MessageItem({ msg, isActive, tab, onClick }) {
  const unread = !msg.is_read && tab === 'inbox';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-[var(--divider)] transition-colors ${
        isActive
          ? 'bg-[var(--color-blue-50)] border-l-2 border-l-[var(--color-blue-500)]'
          : 'hover:bg-[var(--surface-page)] border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[length:13px] truncate ${unread ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
          {tab === 'inbox' ? msg.sender?.name : msg.receiver?.name}
        </p>
        <span className="text-[length:11px] text-[var(--text-muted)] shrink-0">
          {new Date(msg.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
      </div>
      <p className="text-[length:12px] text-[var(--text-muted)] truncate mt-0.5">{msg.subject}</p>
      {unread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-blue-500)] mt-1" />}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MessagesPage({ user }) {
  const [tab,     setTab]     = useState('inbox');
  const [page,    setPage]    = useState(1);
  const [compose, setCompose] = useState(false);
  const [viewing, setViewing] = useState(null);

  const inbox = useInbox({ page, limit: 20 });
  const sent  = useSent({ page, limit: 20 });

  const { data, isLoading, isError, refetch } = tab === 'inbox' ? inbox : sent;

  function handleTabSwitch(t) { setTab(t); setPage(1); setViewing(null); }

  return (
    <Layout user={user}>
      <PageHeader
        title="Messages"
        action={
          <div className="flex flex-col items-center gap-2">
            {/* Same bg-blue-50/text-blue-700 pill treatment as the "upcoming" status badge (see STATUS_COLORS) */}
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[length:11px] font-semibold bg-blue-50 text-blue-700">
              New chat-style experience coming soon
            </span>
            <Button onClick={() => setCompose(true)} size="sm">+ Compose</Button>
          </div>
        }
      />

      {/*
        Mobile:  show EITHER the list OR the thread (full-width), never both.
        Desktop: side-by-side panel layout.
      */}
      <div className="flex bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden flex-1" style={{ minHeight: 400 }}>

        {/* ── Left panel — list ── */}
        {/* On mobile: hidden when a message is open; full-width when no message selected.
            On sm+: always visible at fixed width. */}
        <div
          className={[
            'flex-col border-r border-[var(--border)]',
            'w-full sm:w-[260px] sm:flex-shrink-0',
            viewing ? 'hidden sm:flex' : 'flex',
          ].join(' ')}
        >
          {/* Tab bar */}
          <div className="flex border-b border-[var(--border)]" role="tablist">
            {['inbox', 'sent'].map((t) => (
              <button
                key={t}
                onClick={() => handleTabSwitch(t)}
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                tabIndex={tab === t ? 0 : -1}
                className={`flex-1 py-3 text-[length:13px] font-medium capitalize transition-colors ${
                  tab === t ? 'text-[var(--brand)] border-b-2 border-[var(--brand)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {isLoading && (
              <p className="text-[length:13px] text-[var(--text-muted)] text-center py-8">Loading…</p>
            )}
            {isError && (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-[length:13px] text-[var(--text-muted)]">Couldn't load messages.</p>
                <Button size="xs" variant="light" color="red" onClick={refetch}>Retry</Button>
              </div>
            )}
            {!isLoading && !isError && !data?.data?.length && (
              <p className="text-[length:13px] text-[var(--text-muted)] text-center py-8">No messages.</p>
            )}
            {!isError && data?.data?.map((m) => (
              <MessageItem
                key={m.id}
                msg={m}
                tab={tab}
                isActive={viewing === m.id}
                onClick={() => setViewing(m.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data?.meta && data.meta.pages > 1 && (
            <div className="border-t border-[var(--divider)] p-2">
              <Pagination meta={data.meta} page={page} onPage={setPage} />
            </div>
          )}
        </div>

        {/* ── Right panel — thread or empty state ── */}
        {viewing ? (
          <ThreadPanel
            messageId={viewing}
            currentUser={user}
            onClose={() => setViewing(null)}
          />
        ) : (
          // Empty state: hidden on mobile (list is shown instead), visible on desktop
          <div className="hidden sm:flex flex-1 flex-col items-center justify-center text-[var(--text-muted)] gap-2">
            <p className="text-[length:28px]">✉️</p>
            <p className="text-[length:13px]">Select a message to read it</p>
          </div>
        )}
      </div>

      <ComposeDrawer open={compose} onClose={() => setCompose(false)} />
    </Layout>
  );
}
