import { useState } from 'react';
import { TextInput } from '@mantine/core';
import BottomDrawer, { cancelBtnStyle, primaryBtnStyle } from './ui/BottomDrawer';

const sectionTitle = "text-[length:var(--text-micro)] font-[800] text-[color:var(--text-muted)] uppercase tracking-[0.12em]";

function RoleButton({ label, subtitle, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-2 py-2.5 rounded-xl text-center transition-all duration-150 cursor-pointer border-[1.5px] ${selected ? 'border-[var(--brand)] bg-[var(--color-blue-50)]' : 'border-[var(--border)] bg-[var(--surface-page)]'}`}
    >
      <p className={`text-sm font-bold mb-0.5 ${selected ? 'text-[color:var(--brand)]' : 'text-[color:var(--text-secondary)]'}`}>
        {label}
      </p>
      <p className={`text-[length:var(--text-micro)] ${selected ? 'text-[color:var(--color-blue-400)]' : 'text-[color:var(--text-muted)]'}`}>
        {subtitle}
      </p>
    </button>
  );
}

export default function CreateUserDrawer({ open, onClose, onSubmit, loading, actorRole }) {
  const [form, setForm] = useState({
    name: '', email: '', role: 'faculty',
    department: '', designation: '', title: '', phone: '',
  });
  const [inviteLink, setInviteLink] = useState(null);
  const [invitedName, setInvitedName] = useState('');
  const [assignedSimsId, setAssignedSimsId] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setRole = (r) => setForm(f => ({ ...f, role: r }));

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form, (response) => {
      if (response.invite_link) {
        setInviteLink(response.invite_link);
        setInvitedName(response.invite?.name || form.name);
        setAssignedSimsId(response.invite?.sims_id ?? null);
      } else {
        resetAndClose();
      }
    });
  }

  function resetAndClose() {
    setForm({ name: '', email: '', role: 'faculty', department: '', designation: '', title: '', phone: '' });
    setInviteLink(null);
    setInvitedName('');
    setAssignedSimsId(null);
    onClose();
  }

  function shareOnWhatsApp() {
    const message = `Hi ${invitedName}, your SIMS ID is ${assignedSimsId}. Tap this link to activate your SIMS account: ${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  }

  function extractInviteToken() {
    const match = inviteLink?.match(/[?&]start=([^&]+)/);
    return match ? match[1] : '';
  }

  function copyCommand() {
    navigator.clipboard.writeText(`/start ${extractInviteToken()}`);
  }

  return (
    <BottomDrawer
      open={open}
      onClose={inviteLink ? resetAndClose : onClose}
      title={inviteLink ? 'Invite created' : 'Invite user'}
      subtitle={inviteLink ? `Share with ${invitedName}` : 'An invite link will be sent to their Telegram'}
      footer={
        inviteLink ? (
          <button
            onClick={resetAndClose}
            data-primary=""
            style={{ ...primaryBtnStyle(false), flex: 1, maxWidth: 200, margin: '0 auto' }}
          >
            Done
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              onClick={handleSubmit}
              data-primary=""
              style={primaryBtnStyle(loading || !form.name.trim())}
            >
              {loading ? '🔄 Sending...' : 'Send Invite'}
            </button>
          </>
        )
      }
    >
      {inviteLink ? (
        // ── INVITE LINK PANEL ──
        <div className="p-5 flex flex-col gap-3.5">
          {assignedSimsId && (
            <div className="bg-[var(--surface-page)] rounded-xl p-4 text-center border-[1.5px] border-[var(--brand)]">
              <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] mb-1 uppercase tracking-[0.12em] font-bold">Assigned SIMS ID</p>
              <p className="text-3xl font-extrabold text-[var(--brand)] font-mono tracking-[0.18em]">{assignedSimsId}</p>
              <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] mt-1">Permanent ID — it will not be reused.</p>
            </div>
          )}

          <div className="bg-[var(--color-blue-50)] border-[1.5px] border-[var(--color-blue-200)] rounded-xl p-3 text-xs text-[var(--color-blue-800)] leading-relaxed">
            <p className="font-bold mb-2">📋 Instructions:</p>
            <ol className="m-0 pl-[18px]">
              <li>Open Telegram and search for <strong>@SimsPharmacybot</strong></li>
              <li>Tap "Start" when you open the bot</li>
              <li>Copy and send this exact message:</li>
            </ol>
          </div>

          <div className="bg-[var(--surface-page)] rounded-lg p-2.5 text-center border-[1.5px] border-[var(--border)]">
            <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] m-0 mb-1.5">Bot Username</p>
            <p className="text-sm font-bold text-[var(--text-primary)] m-0 font-mono">
              @SimsPharmacybot
            </p>
          </div>

          <div className="bg-[var(--surface-page)] rounded-lg p-3 text-xs text-[var(--text-primary)] font-semibold border-[1.5px] border-[var(--border)] break-all font-mono">
            /start {extractInviteToken()}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={copyCommand}
              className="w-full h-11 rounded-lg font-bold text-sm text-[var(--brand)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-blue-100)] border-[1.5px] border-[var(--brand)] bg-[var(--color-blue-50)]"
            >
              📋 Copy command
            </button>
            <a
              href={inviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-11 rounded-lg border-0 bg-[var(--color-cyan-solid)] text-xs font-bold text-[var(--text-on-brand)] cursor-pointer no-underline transition-all duration-150 hover:bg-[var(--color-cyan-700)]"
            >
              🔗 Open Telegram
            </a>
            <button
              onClick={shareOnWhatsApp}
              className="w-full h-11 rounded-lg border-0 bg-[var(--success)] text-xs font-bold text-[var(--text-on-brand)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-emerald-700)]"
            >
              💬 Share WhatsApp
            </button>
          </div>

          <p className="text-[length:var(--text-micro)] text-[color:var(--text-muted)] text-center leading-[1.5]">
            Link expires in 7 days.<br />
            If issues with deep links, use the command method above.
          </p>
        </div>
      ) : (
        // ── FORM ──
        <form onSubmit={handleSubmit} className="px-5 py-4 pb-2 flex flex-col gap-4">

          <p className={sectionTitle}>
            Identity
          </p>
          <TextInput label="Full name" placeholder="Priya Sharma" value={form.name} onChange={set('name')} required autoComplete="name" />
          <TextInput label="Email (optional)" type="email" placeholder="priya@sims.edu.in" value={form.email} onChange={set('email')} autoComplete="email" />

          <p className={sectionTitle}>
            Role
          </p>
          <div className="flex gap-2">
            <RoleButton label="Faculty" subtitle="Records violations" selected={form.role === 'faculty'} onClick={() => setRole('faculty')} />
            {actorRole === 'super_admin' && (
              <RoleButton label="Admin" subtitle="Manages system" selected={form.role === 'admin'} onClick={() => setRole('admin')} />
            )}
          </div>

          <p className={sectionTitle}>
            Department
          </p>
          <TextInput label="Department" placeholder="Pharmacology" value={form.department} onChange={set('department')} />
          <TextInput label="Designation" placeholder="Assistant Professor" value={form.designation} onChange={set('designation')} />
          <TextInput label="Title" placeholder="Dr. / Prof. / Mr." value={form.title} onChange={set('title')} />

          <p className={sectionTitle}>
            Contact
          </p>
          <TextInput label="Phone" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} autoComplete="tel" />

        </form>
      )}
    </BottomDrawer>
  );
}
