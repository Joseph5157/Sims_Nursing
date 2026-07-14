import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout, { PageHeader } from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { Button } from '@mantine/core';
import { Table, Th, Td, EmptyRow } from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';
import Skeleton, { TableRowSkeleton } from '../components/ui/Skeleton';
import { ROUTES } from '../utils/constants';

function getNotificationTypeLabel(type) {
  const labels = {
    duty_assigned: 'Duty Assigned',
    duty_reassigned: 'Duty Reassigned',
    violation: 'Student Violation',
    message: 'Message',
    system: 'System',
  };
  return labels[type] || type;
}

function getTypeColor(type) {
  const colors = {
    duty_assigned: 'var(--color-blue-600)',
    duty_reassigned: 'var(--color-indigo-600)',
    violation: 'var(--color-red-600)',
    message: 'var(--color-cyan-600)',
    system: 'var(--color-slate-600)',
  };
  return colors[type] || 'var(--color-slate-600)';
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage({ user }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  // Notifications feature disabled — backend module not yet implemented
  const NOTIFICATIONS_ENABLED = false;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications-page', page, filter],
    enabled: NOTIFICATIONS_ENABLED,
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ page, limit: 20 });
        if (filter !== 'all') params.append('filter', filter);
        const res = await fetch(`/api/notifications/list?${params}`);
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
        return { data: [], meta: { total: 0, page: 1, pages: 1 } };
      }
    },
  });

  // ── Feature disabled — show placeholder ──────────────────────────────────────
  if (!NOTIFICATIONS_ENABLED) {
    return (
      <Layout user={user}>
        <Breadcrumb items={[
          { label: 'Dashboard', href: user?.role === 'faculty' ? ROUTES.FACULTY_DASHBOARD : ROUTES.ADMIN_DASHBOARD },
          { label: 'Notifications' },
        ]} />
        <PageHeader title="Notifications" subtitle="View and manage your notifications" />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 400, gap: 16, padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>🔔</div>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Notifications Not Yet Available
          </h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: 0 }}>
            The notifications feature is currently under development. Check back soon for real-time updates and alerts.
          </p>
        </div>
      </Layout>
    );
  }

  // ── Enabled branch (not yet reached — backend routes not implemented) ─────────
  // TODO: remove NOTIFICATIONS_ENABLED guard once backend module ships

  const notifications = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, pages: 1 };

  const markAsRead = async (notificationId) => {
    try {
      // TODO: backend route doesn't exist yet — /api/notifications/:id/read (PATCH)
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      toast({ message: 'Marked as read' });
      refetch();
    } catch (err) {
      toast({ message: 'Failed to mark as read', type: 'error' });
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      // TODO: backend route doesn't exist yet — /api/notifications/:id (DELETE)
      await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      toast({ message: 'Notification deleted' });
      refetch();
    } catch (err) {
      toast({ message: 'Failed to delete notification', type: 'error' });
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'PATCH' });
      toast({ message: 'All marked as read' });
      refetch();
    } catch (err) {
      toast({ message: 'Failed to mark all as read', type: 'error' });
    }
  };

  const deleteAllRead = async () => {
    if (!window.confirm('Delete all read notifications?')) return;
    try {
      await fetch('/api/notifications/delete-read', { method: 'DELETE' });
      toast({ message: 'Read notifications deleted' });
      refetch();
    } catch (err) {
      toast({ message: 'Failed to delete notifications', type: 'error' });
    }
  };

  return (
    <Layout user={user}>
      <Breadcrumb items={[
        { label: 'Dashboard', href: user?.role === 'faculty' ? ROUTES.FACULTY_DASHBOARD : ROUTES.ADMIN_DASHBOARD },
        { label: 'Notifications' },
      ]} />

      <PageHeader
        title="Notifications"
        subtitle="View and manage your notifications"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="default" size="sm" onClick={markAllAsRead} disabled={notifications.length === 0}>
              Mark all read
            </Button>
            <Button variant="default" size="sm" onClick={deleteAllRead} disabled={notifications.length === 0}>
              Delete read
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', 'unread', 'duty_assigned', 'duty_reassigned', 'violation', 'message'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              backgroundColor: filter === f ? 'var(--color-blue-600)' : 'transparent',
              color: filter === f ? 'white' : 'var(--text-primary)',
              fontSize: 'var(--text-card)', fontWeight: 'var(--weight-medium)',
              cursor: 'pointer', transition: 'all var(--dur-fast)',
            }}
            onMouseEnter={(e) => { if (filter !== f) e.currentTarget.style.backgroundColor = 'var(--color-slate-100)'; }}
            onMouseLeave={(e) => { if (filter !== f) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {f === 'all' ? 'All' : getNotificationTypeLabel(f)}
          </button>
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Type</Th>
            <Th>Title</Th>
            <Th>Message</Th>
            <Th>Date</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {isLoading && Array.from({ length: 10 }).map((_, i) => (
            <TableRowSkeleton key={i} cols={6} />
          ))}
          {!isLoading && notifications.length === 0 && <EmptyRow cols={6} />}
          {notifications.map((notif) => (
            <tr key={notif.id}>
              <Td>
                <span style={{
                  display: 'inline-block', padding: '4px 8px',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--text-small)',
                  fontWeight: 'var(--weight-semibold)', color: getTypeColor(notif.type),
                  backgroundColor: `${getTypeColor(notif.type)}15`,
                }}>
                  {getNotificationTypeLabel(notif.type)}
                </span>
              </Td>
              <Td className="font-medium">{notif.title}</Td>
              <Td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                {notif.message}
              </Td>
              <Td style={{ fontSize: 'var(--text-micro)', color: 'var(--text-muted)' }}>{formatDate(notif.createdAt)}</Td>
              <Td>
                <span style={{
                  display: 'inline-block', padding: '4px 8px', borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-small)', fontWeight: 'var(--weight-semibold)',
                  backgroundColor: notif.readAt ? 'var(--color-slate-100)' : 'var(--color-blue-100)',
                  color: notif.readAt ? 'var(--color-slate-700)' : 'var(--color-blue-700)',
                }}>
                  {notif.readAt ? 'Read' : 'Unread'}
                </span>
              </Td>
              <Td>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!notif.readAt && (
                    <Button variant="subtle" size="xs" onClick={() => markAsRead(notif.id)}>
                      Mark read
                    </Button>
                  )}
                  <Button variant="subtle" color="red" size="xs" onClick={() => deleteNotification(notif.id)}>
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Pagination meta={meta} page={page} onPage={setPage} />
    </Layout>
  );
}
