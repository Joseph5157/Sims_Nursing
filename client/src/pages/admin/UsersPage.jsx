import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout, { PageHeader } from '../../components/Layout';
import { Table, Th, Td, EmptyRow, ErrorRow, ErrorBlock } from '../../components/ui/Table';
import { Button, Menu, ActionIcon, Modal, Text, Group } from '@mantine/core';
import Badge from '../../components/ui/Badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import CreateUserDrawer from '../../components/CreateUserDrawer';
import { useToast } from '../../components/ui/Toast';
import { useDebounce } from '../../hooks/useDebounce';
import { useUsers, useDeactivateUser, useReactivateUser, useDeleteUser, useResetUserLogin } from '../../hooks/useUsers';
import { useInvites, useCreateInvite, useRegenerateInvite, useCancelInvite } from '../../hooks/useInvites';
import Breadcrumb from '../../components/Breadcrumb';

// ── Row menu for users ──────────────────────────────────────────────────────
function RowMenu({ user: u, userRole, onDeactivate, onReactivate, onResetPassword, onDelete }) {
  if (u.role === 'super_admin') return null;
  const isSuperAdmin = userRole === 'super_admin';

  return (
    <Menu shadow="md" width={180} position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label="User actions">
          ···
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {u.status === 'active' && (
          <Menu.Item color="red" onClick={() => onDeactivate(u)}>Deactivate</Menu.Item>
        )}
        {isSuperAdmin && (
          <Menu.Item onClick={() => onResetPassword(u)}>Reset Password</Menu.Item>
        )}
        {u.status === 'inactive' && (
          <Menu.Item color="green" onClick={() => onReactivate(u)}>Reactivate</Menu.Item>
        )}
        {isSuperAdmin && (
          <>
            <Menu.Divider />
            <Menu.Item color="red" onClick={() => onDelete(u)}>Delete User</Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

// ── Row menu for pending invites ────────────────────────────────────────────
function InviteRowMenu({ invite, onRegenerate, onCancel }) {
  return (
    <Menu shadow="md" width={160} position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Invite actions">
          ···
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => onRegenerate(invite)}>Regenerate</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" onClick={() => onCancel(invite)}>Cancel</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function UsersPage({ user }) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [page,       setPage]       = useState(1);
  const [role,       setRole]       = useState(() => searchParams.get('role')   ?? '');
  const [status,     setStatus]     = useState(() => searchParams.get('status') ?? '');
  const [search,     setSearch]     = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Confirm-dialog states (replaces window.confirm)
  const [deactivatingUser,  setDeactivatingUser]  = useState(null);
  const [reactivatingUser,  setReactivatingUser]  = useState(null);
  const [deletingUser,      setDeletingUser]      = useState(null);
  const [cancellingInvite,  setCancellingInvite]  = useState(null);
  const [resettingPassword, setResettingPassword] = useState(null);
  const [passwordResetResult, setPasswordResetResult] = useState(null);

  const debouncedSearch = useDebounce(search, 500);
  const { data, isLoading, isError, refetch } = useUsers({ role, status, search: debouncedSearch, page, limit: 20 });
  const { data: invitesData, isLoading: invitesLoading, isError: invitesError, refetch: refetchInvites } = useInvites();

  const createInvite     = useCreateInvite();
  const deactivate       = useDeactivateUser();
  const reactivate       = useReactivateUser();
  const resetUserLogin   = useResetUserLogin();
  const regenerateInvite = useRegenerateInvite();
  const cancelInvite     = useCancelInvite();
  const deleteUser       = useDeleteUser();

  async function handleDeactivate() {
    try {
      await deactivate.mutateAsync(deactivatingUser.id);
      toast({ message: `${deactivatingUser.name} deactivated.` });
      setDeactivatingUser(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  async function handleReactivate() {
    try {
      await reactivate.mutateAsync(reactivatingUser.id);
      toast({ message: `${reactivatingUser.name} reactivated.` });
      setReactivatingUser(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  async function doResetPassword() {
    const target = resettingPassword;
    try {
      const response = await resetUserLogin.mutateAsync(target.id);
      const body = response.data;
      setResettingPassword(null);
      if (body.telegram_delivered) {
        toast({ message: `Password reset for ${target.name}. They were notified via Telegram.` });
      } else {
        // Telegram delivery failed (or no Telegram linked) — the temp password only
        // exists in this response, so show it in a modal rather than a toast that
        // disappears before it can be relayed to the user.
        setPasswordResetResult({ name: target.name, tempPassword: body.temp_password });
      }
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  async function handleDelete() {
    try {
      await deleteUser.mutateAsync(deletingUser.id);
      toast({ message: `${deletingUser.name} deleted.` });
      setDeletingUser(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed to delete user.', type: 'error' });
    }
  }

  async function handleRegenerateInvite(inv) {
    try {
      const response = await regenerateInvite.mutateAsync(inv.id);
      if (response.data?.invite_link) {
        navigator.clipboard.writeText(response.data.invite_link).catch(() => {});
      }
      toast({ message: 'New invite link generated. Copied to clipboard.' });
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  async function handleCancelInvite() {
    try {
      await cancelInvite.mutateAsync(cancellingInvite.id);
      toast({ message: `Invite for ${cancellingInvite.name} cancelled.` });
      setCancellingInvite(null);
    } catch (err) {
      toast({ message: err.response?.data?.message ?? 'Failed.', type: 'error' });
    }
  }

  const selectCls = 'border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-secondary)] outline-none focus:border-[var(--brand)] focus:ring-[3px] focus:ring-[var(--brand)]/15 bg-[var(--surface-card)]';
  const selectStyle = { fontSize: 16 };

  return (
    <Layout user={user}>
      <Breadcrumb items={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Users' }]} />
      <PageHeader
        title="User Management"
        subtitle="Manage faculty and admin accounts"
        action={<Button size="md" onClick={() => setShowCreate(true)}>+ Invite User</Button>}
      />

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          className="border border-[var(--border)] rounded-lg px-3 py-2 flex-1 min-w-[200px] outline-none focus:border-[var(--brand)] focus:ring-[3px] focus:ring-[var(--brand)]/15 placeholder:text-[var(--text-muted)] bg-[var(--surface-card)] text-[var(--text-primary)]"
          style={{ fontSize: 16 }}
          placeholder="Search by name or SIMS ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={selectCls} style={selectStyle}>
          <option value="">All roles</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls} style={selectStyle}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending Approval</option>
          <option value="pending_telegram">Telegram Relink Needed</option>
          <option value="notify_failed">Notification Failed</option>
        </select>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden" style={{ backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>Loading…</div>}
        {isError && <ErrorBlock onRetry={refetch} />}
        {!isLoading && !isError && !data?.data?.length && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-card)' }}>No users found.</div>}
        {data?.data?.map((u) => (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', backgroundColor: 'var(--surface-card)',
            borderBottom: '1px solid var(--border)', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 'var(--text-card-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.name}
              </p>
              <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>SIMS ID {u.sims_id}{u.email ? ` · ${u.email}` : ''}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Badge status={u.role} label={u.role.replace(/_/g, ' ')} />
              <Badge status={u.status} />
              {u.activation_notification_failed && (
                <Badge status="flagged" label="⚠ Notify failed" />
              )}
            </div>
            <RowMenu
              user={u}
              userRole={user.role}
              onDeactivate={setDeactivatingUser}
              onReactivate={setReactivatingUser}
              onResetPassword={setResettingPassword}
              onDelete={setDeletingUser}
            />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>SIMS ID</Th>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th className="hidden sm:table-cell">Department</Th>
              <Th className="hidden md:table-cell">Telegram ID</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow cols={7} message="Loading…" />}
            {isError && <ErrorRow cols={7} onRetry={refetch} />}
            {!isLoading && !isError && !data?.data?.length && <EmptyRow cols={7} />}
            {data?.data?.map((u) => (
              <tr key={u.id}>
                <Td><span className="font-mono font-bold text-[var(--brand)]">{u.sims_id}</span></Td>
                <Td>
                  <p className="font-medium text-[var(--text-primary)]">{u.name}</p>
                  <p className="text-[length:11px] text-[var(--text-muted)]">{u.email || 'No email added'}</p>
                </Td>
                <Td><Badge status={u.role} label={u.role.replace(/_/g, ' ')} /></Td>
                <Td className="hidden sm:table-cell">{u.department ?? '—'}</Td>
                <Td className="hidden md:table-cell">
                  <span className="font-mono text-[length:12px] text-[var(--text-secondary)]">
                    {u.telegram_id ?? '—'}
                  </span>
                </Td>
                <Td>
                  <Badge status={u.status} />
                  {u.activation_notification_failed && (
                    <Badge status="flagged" label="⚠ Notify failed" className="ml-1" />
                  )}
                </Td>
                <Td>
                  <RowMenu
                    user={u}
                    userRole={user.role}
                    onDeactivate={setDeactivatingUser}
                    onReactivate={setReactivatingUser}
                    onResetPassword={setResettingPassword}
                    onDelete={setDeletingUser}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div style={{
        marginTop: 16, padding: '12px 16px',
        backgroundColor: 'var(--surface-page)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Showing</span>
        <span style={{ fontSize: 'var(--text-body)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
          {data?.meta?.total ?? 0}
        </span>
      </div>

      <Pagination meta={data?.meta} page={page} onPage={setPage} />

      {/* ── PENDING INVITES SECTION ── */}
      <div style={{ marginTop: 32, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-card-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 2 }}>Pending Invites</h2>
            <p style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>Invite links not yet activated</p>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>SIMS ID</Th>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th className="hidden sm:table-cell">Expires</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {invitesLoading && <EmptyRow cols={6} message="Loading…" />}
            {invitesError && <ErrorRow cols={6} onRetry={refetchInvites} />}
            {!invitesLoading && !invitesError && !invitesData?.data?.length && <EmptyRow cols={6} message="No pending invites." />}
            {invitesData?.data?.map((inv) => (
              <tr key={inv.id}>
                <Td><span className="font-mono font-bold text-[var(--brand)]">{inv.sims_id}</span></Td>
                <Td><p className="font-medium text-[var(--text-primary)]">{inv.name}</p></Td>
                <Td>{inv.email || '—'}</Td>
                <Td><Badge status={inv.role} label={inv.role.replace(/_/g, ' ')} /></Td>
                <Td className="hidden sm:table-cell text-[length:12px] text-[var(--text-secondary)]">
                  {new Date(inv.invite_expires_at).toLocaleDateString()}
                </Td>
                <Td>
                  <InviteRowMenu
                    invite={inv}
                    onRegenerate={handleRegenerateInvite}
                    onCancel={setCancellingInvite}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <CreateUserDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        actorRole={user.role}
        onSubmit={async (form, callback) => {
          try {
            const response = await createInvite.mutateAsync(form);
            toast({ message: 'Invite created.' });
            callback(response.data);
          } catch (err) {
            toast({ message: err.response?.data?.message ?? 'Failed to create invite.', type: 'error' });
          }
        }}
        loading={createInvite.isPending}
      />

      {deactivatingUser && (
        <ConfirmDialog
          open
          title="Deactivate User"
          message={`Deactivate ${deactivatingUser.name}?`}
          confirmText="Deactivate"
          isDangerous
          isLoading={deactivate.isPending}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivatingUser(null)}
        />
      )}
      {reactivatingUser && (
        <ConfirmDialog
          open
          title="Reactivate User"
          message={
            reactivatingUser.status === 'pending_telegram'
              ? `${reactivatingUser.name}'s Telegram link is unresolved, so reactivation will be rejected. There's currently no in-app way to issue a new relink link for this account — contact the project owner to resolve it first.`
              : `Reactivate ${reactivatingUser.name}?`
          }
          confirmText="Reactivate"
          isLoading={reactivate.isPending}
          onConfirm={handleReactivate}
          onCancel={() => setReactivatingUser(null)}
        />
      )}
      {deletingUser && (
        <ConfirmDialog
          open
          title="Delete User"
          message={`Delete ${deletingUser.name}? This action cannot be undone.`}
          confirmText="Delete"
          isDangerous
          isLoading={deleteUser.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeletingUser(null)}
        />
      )}
      {cancellingInvite && (
        <ConfirmDialog
          open
          title="Cancel Invite"
          message={`Cancel invite for ${cancellingInvite.name}?`}
          confirmText="Cancel Invite"
          isDangerous
          isLoading={cancelInvite.isPending}
          onConfirm={handleCancelInvite}
          onCancel={() => setCancellingInvite(null)}
        />
      )}
      {resettingPassword && (
        <ConfirmDialog
          open
          title="Reset Password"
          message={`Generate a new temporary password for ${resettingPassword.name}? ${
            resettingPassword.telegram_id
              ? "It will be sent to them via Telegram."
              : "They have no Telegram linked, so it will be shown here for you to relay manually."
          } They'll be required to change it on next login.`}
          confirmText="Reset Password"
          isDangerous
          isLoading={resetUserLogin.isPending}
          onConfirm={doResetPassword}
          onCancel={() => setResettingPassword(null)}
        />
      )}
      {passwordResetResult && (
        <Modal
          opened
          onClose={() => setPasswordResetResult(null)}
          title="Telegram delivery failed"
          size="sm"
          centered
        >
          <Text size="sm" c="dimmed" mb="md">
            {passwordResetResult.name}'s password was reset, but the Telegram notification
            could not be delivered. Relay this temporary password to them directly (phone,
            in person, etc.) — it will not be shown again.
          </Text>
          <Group gap="xs" mb="sm" wrap="nowrap">
            <code className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-page)] text-[var(--text-primary)] text-sm font-mono break-all">
              {passwordResetResult.tempPassword}
            </code>
            <Button
              size="xs"
              variant="default"
              onClick={() => navigator.clipboard.writeText(passwordResetResult.tempPassword).catch(() => {})}
            >
              Copy password
            </Button>
          </Group>
          <div className="rounded-lg px-3 py-2 text-xs" style={{ marginBottom: 24, backgroundColor: 'var(--color-amber-bg)', border: '1px solid var(--color-amber-border)', color: 'var(--color-amber-text)' }}>
            ⚠ Share this password directly with the user (phone call, in person, etc.) —
            don't send it over email or a public/group chat.
          </div>
          <Group justify="flex-end">
            <Button onClick={() => setPasswordResetResult(null)}>Done</Button>
          </Group>
        </Modal>
      )}
    </Layout>
  );
}
