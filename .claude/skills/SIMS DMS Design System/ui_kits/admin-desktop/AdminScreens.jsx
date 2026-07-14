/* ──────────────────────────────────────────────────────────────
   Admin Desktop — UsersPage + CreateUserDrawer (invite-only)
   Based on client/src/pages/admin/UsersPage.jsx +
   client/src/components/CreateUserDrawer.jsx (post-redesign)
   ────────────────────────────────────────────────────────────── */
const { useState, useRef, useEffect } = React;
const DS = window.SIMSDMSDesignSystem_019e12;
const { Button, Badge, StatCard, Alert } = DS;

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { id: 1, name: 'Joseph K',      email: 'joseph@sims.edu',       role: 'super_admin', dept: '—',              telegram_id: '8823041', status: 'active' },
  { id: 2, name: 'Priya Sharma',  email: 'priya.sharma@sims.edu', role: 'faculty',     dept: 'Pharmaceutics',  telegram_id: '7712890', status: 'active' },
  { id: 3, name: 'Anil Kumar',    email: 'anil.kumar@sims.edu',   role: 'faculty',     dept: 'Pharmacology',   telegram_id: '5590312', status: 'active' },
  { id: 4, name: 'Reena Joseph',  email: 'reena.j@sims.edu',      role: 'faculty',     dept: 'Clinical',       telegram_id: null,      status: 'pending_telegram' },
  { id: 5, name: 'Sanjay Nair',   email: 'sanjay.nair@sims.edu',  role: 'admin',       dept: '—',              telegram_id: '6678023', status: 'inactive' },
];

const MOCK_INVITES = [
  { id: 1, email: 'dr.fatima@sims.edu',   role: 'faculty', sent: '10 Jun 2026', expires: '17 Jun 2026' },
  { id: 2, email: 'pradeep.r@sims.edu',   role: 'faculty', sent: '09 Jun 2026', expires: '16 Jun 2026' },
  { id: 3, email: 'meera.admin@sims.edu', role: 'admin',   sent: '04 Jun 2026', expires: '11 Jun 2026' },
];

const DEPT_OPTIONS = ['Pharmaceutics', 'Pharmacology', 'Clinical Pharmacy', 'Pharmacy Practice', 'Pharmaceutical Chemistry'];

// ── Shared helpers ───────────────────────────────────────────────────────────
const Divider = () => <div style={{ borderBottom: '1px solid var(--divider)' }} />;

function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ border: '1px solid var(--slate-200)', borderRadius: 8, padding: '7px 12px', fontSize: 13, color: 'var(--slate-700)', background: '#fff', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Row action menu ──────────────────────────────────────────────────────────
function RowMenu({ user: u, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (u.role === 'super_admin') return null;
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'none', color: 'var(--slate-400)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ···
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 10, boxShadow: 'var(--shadow-dropdown)', minWidth: 150, padding: '4px 0' }}>
          {u.status === 'active' && (
            <button onClick={() => { setOpen(false); onAction('deactivate', u); }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: 'var(--red-text)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Deactivate
            </button>
          )}
          {u.status === 'pending_telegram' && (
            <button onClick={() => { setOpen(false); onAction('regen', u); }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: 'var(--blue-700)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Regenerate invite
            </button>
          )}
          {u.status === 'inactive' && (
            <button onClick={() => { setOpen(false); onAction('reactivate', u); }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: 'var(--emerald-text)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Reactivate
            </button>
          )}
          <Divider />
          <button onClick={() => { setOpen(false); onAction('delete', u); }}
            style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: 'var(--red-text)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Delete user
          </button>
        </div>
      )}
    </div>
  );
}

// ── Pending Invites section ──────────────────────────────────────────────────
function PendingInvitesSection({ invites, onRegenerate, onCancel }) {
  if (!invites.length) return null;
  const expired = inv => inv.id === 3; // mock: last one is "today" = just expired
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending Invites</p>
          <span style={{ background: 'var(--amber-tint)', color: 'var(--amber-text)', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '2px 7px' }}>{invites.length}</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Links expire after 7 days — regenerate to extend</p>
      </div>
      <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Table head */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 0, padding: '8px 16px', borderBottom: '1px solid var(--amber-border)' }}>
          {['Email', 'Role', 'Sent', 'Expires', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber-text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>
        {invites.map((inv, idx) => {
          const isExpired = expired(inv);
          return (
            <div key={inv.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
              alignItems: 'center', gap: 0, padding: '10px 16px',
              borderBottom: idx < invites.length - 1 ? '1px solid var(--amber-border)' : 'none',
              background: isExpired ? 'rgba(254,202,202,0.2)' : 'transparent',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{inv.email}</span>
              <Badge status={inv.role} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.sent}</span>
              <span style={{ fontSize: 12, color: isExpired ? 'var(--red-text)' : 'var(--text-secondary)', fontWeight: isExpired ? 600 : 400 }}>
                {isExpired ? '⚑ Expired' : inv.expires}
              </span>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => onRegenerate(inv)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--amber-border)', background: '#fff', color: 'var(--amber-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                  <Ic name="refresh" size={11} /> Regenerate
                </button>
                <button onClick={() => onCancel(inv)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--red-border)', background: '#fff', color: 'var(--red-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <Ic name="x" size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Create User Drawer — matches client/src/components/CreateUserDrawer.jsx ──
// Title: "Invite user", no telegram_id field, actorRole gates Admin role button,
// invite panel shows @SimsPharmacybot bot name + /start {token} command.
function CreateUserDrawer({ open, onClose, actorRole = 'admin' }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'faculty', department: '', designation: '', phone: '' });
  const [inviteLink, setInviteLink] = useState(null);
  const [invitedName, setInvitedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const token = 'invite_' + Math.random().toString(36).slice(2, 10);
      setInviteLink('https://t.me/SimsPharmacybot?start=' + token);
      setInvitedName(form.name);
    }, 700);
  }

  function resetAndClose() {
    setForm({ name: '', email: '', role: 'faculty', department: '', designation: '', phone: '' });
    setInviteLink(null); setInvitedName(''); setCopied(false);
    onClose();
  }

  function extractToken() {
    const m = inviteLink?.match(/[?&]start=([^&]+)/);
    return m ? m[1] : '';
  }

  function copyCommand() { setCopied(true); setTimeout(() => setCopied(false), 2000); }

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 40 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)', maxWidth: 520, margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
        <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
              {inviteLink ? '✅ Invite created' : 'Invite user'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
              {inviteLink ? 'Share instructions with ' + invitedName : 'An invite link will be sent to their Telegram'}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>✕</button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {inviteLink ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>✅ Invite created</p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Share instructions with {invitedName}</p>
              </div>
              {/* Instructions */}
              <div style={{ background: '#f0f9ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 12, fontSize: 12, color: '#1e40af', lineHeight: 1.6 }}>
                <p style={{ fontWeight: 700, margin: '0 0 8px' }}>📋 Instructions:</p>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Open Telegram and search for <strong>@SimsPharmacybot</strong></li>
                  <li>Tap "Start" when you open the bot</li>
                  <li>Copy and send this exact message:</li>
                </ol>
              </div>
              {/* Bot username */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 6px' }}>Bot Username</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)', margin: 0 }}>@SimsPharmacybot</p>
              </div>
              {/* /start token */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
                /start {extractToken()}
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={copyCommand} style={{ height: 44, borderRadius: 10, border: '1.5px solid #3b82f6', background: copied ? '#f0fdf4' : '#eff6ff', color: copied ? '#065f46' : '#2563eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {copied ? '✅ Copied!' : '📋 Copy command'}
                </button>
                <a href={inviteLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 10, border: 'none', background: '#0088cc', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
                  🔗 Open Telegram
                </a>
                <button style={{ height: 44, borderRadius: 10, border: 'none', background: '#25d366', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  💬 Share WhatsApp
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>Link expires in 7 days.<br />If issues with deep links, use the command method above.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <SectionLabel>Identity</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <DrawerField label="Full name"><DrawerInput placeholder="Dr. Priya Sharma" value={form.name} onChange={set('name')} required /></DrawerField>
                <DrawerField label="Email"><DrawerInput type="email" placeholder="priya@sims.edu.in" value={form.email} onChange={set('email')} required /></DrawerField>
              </div>
              <SectionLabel>Role</SectionLabel>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <RoleBtn label="Faculty" subtitle="Records violations" selected={form.role === 'faculty'} onClick={() => setForm(f => ({ ...f, role: 'faculty' }))} />
                {actorRole === 'super_admin' && (
                  <RoleBtn label="Admin" subtitle="Manages system" selected={form.role === 'admin'} onClick={() => setForm(f => ({ ...f, role: 'admin' }))} />
                )}
              </div>
              <SectionLabel>Department</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <DrawerField label="Department"><DrawerInput placeholder="Pharmacology" value={form.department} onChange={set('department')} /></DrawerField>
                <DrawerField label="Designation"><DrawerInput placeholder="Assistant Professor" value={form.designation} onChange={set('designation')} /></DrawerField>
              </div>
              <SectionLabel>Contact</SectionLabel>
              <div style={{ marginBottom: 24 }}>
                <DrawerField label="Phone"><DrawerInput type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} /></DrawerField>
              </div>
            </form>
          )}
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexShrink: 0, background: '#fff', justifyContent: inviteLink ? 'center' : 'flex-start', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {inviteLink ? (
            <button onClick={resetAndClose} style={{ flex: 1, maxWidth: 200, height: 48, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #2563eb, #4f46e5)', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Done</button>
          ) : (
            <>
              <button type="button" onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 14, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 14, fontWeight: 700, color: '#475569', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={loading || !form.name.trim() || !form.email.trim()}
                style={{ flex: 2, height: 48, borderRadius: 14, border: 'none', background: !form.name.trim() || !form.email.trim() ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #4f46e5)', fontSize: 14, fontWeight: 700, color: '#fff', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
                {loading && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'simsdms-spin .6s linear infinite' }} />}
                {loading ? 'Sending...' : 'Send Invite'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Tiny drawer helpers
function SectionLabel({ children }) {
  return <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{children}</p>;
}
function RoleBtn({ label, subtitle, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${selected ? '#3b82f6' : '#e2e8f0'}`, background: selected ? '#eff6ff' : '#f8fafc', cursor: 'pointer', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: selected ? '#2563eb' : '#475569', marginBottom: 1 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 10, color: selected ? '#60a5fa' : '#94a3b8' }}>{subtitle}</p>
    </button>
  );
}
function DrawerField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.08em', marginBottom: 5, textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  );
}
function DrawerInput({ ...props }) {
  const [f, setF] = useState(false);
  return <input onFocus={() => setF(true)} onBlur={() => setF(false)} style={{ width: '100%', height: 44, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${f ? 'var(--blue-500)' : 'var(--border)'}`, background: f ? '#fff' : 'var(--surface-page)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-sans)', boxShadow: f ? '0 0 0 3px var(--brand-ring)' : 'none', transition: 'all var(--dur-fast)' }} {...props} />;
}

// ── Users Page ────────────────────────────────────────────────────────────────
function UsersPage() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [invites, setInvites] = useState(MOCK_INVITES);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleAction(action, user) {
    if (action === 'deactivate') { setUsers(us => us.map(u => u.id === user.id ? { ...u, status: 'inactive' } : u)); showToast(`${user.name} deactivated.`); }
    if (action === 'reactivate') { setUsers(us => us.map(u => u.id === user.id ? { ...u, status: 'active' } : u)); showToast(`${user.name} reactivated.`); }
    if (action === 'regen') showToast('Invite link regenerated. Share with user.');
    if (action === 'delete') { setUsers(us => us.filter(u => u.id !== user.id)); showToast(`${user.name} deleted.`, 'error'); }
  }

  const filtered = users.filter(u =>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search)) &&
    (!roleFilter || u.role === roleFilter) &&
    (!statusFilter || u.status === statusFilter)
  );

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 28, zIndex: 99, background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${toast.type === 'error' ? 'var(--red-border)' : 'var(--emerald-border)'}`, borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: toast.type === 'error' ? 'var(--red-text)' : 'var(--emerald-text)', boxShadow: 'var(--shadow-toast)' }}>
          {toast.type === 'error' ? '⚑ ' : '✅ '}{toast.msg}
        </div>
      )}

      {/* Alerts */}
      {users.some(u => u.status === 'pending_telegram') && (
        <Alert tone="warning" icon="⏳" title={`${users.filter(u => u.status === 'pending_telegram').length} account awaiting Telegram activation`}
          action={<button style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber-text)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>Regenerate invite →</button>}
          style={{ marginBottom: 14 }}>
          These users need to tap their Telegram invite link before they can sign in.
        </Alert>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total users"   value={users.length}                                            accent="blue"    icon="👥" />
        <StatCard label="Active"        value={users.filter(u => u.status === 'active').length}         accent="green"   icon="✅" />
        <StatCard label="Awaiting"      value={users.filter(u => u.status === 'pending_telegram').length} accent="yellow" icon="⏳" />
        <StatCard label="Pending invites" value={invites.length}                                        accent={invites.length ? 'yellow' : 'default'} icon="✉️" />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}><Ic name="search" size={13} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 36, borderRadius: 8, border: '1px solid var(--slate-200)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }} />
        </div>
        <FilterSelect value={roleFilter} onChange={setRoleFilter} placeholder="All roles"
          options={[{ value: 'faculty', label: 'Faculty' }, { value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="All statuses"
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'pending_telegram', label: 'Awaiting Telegram' }]} />
        <button onClick={() => setShowCreate(true)}
          style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
          + Invite user
        </button>
      </div>

      {/* Users table */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {/* Head */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 36px', padding: '9px 16px', background: 'var(--surface-page)', borderBottom: '1px solid var(--border)' }}>
          {['Name', 'Role', 'Department', 'Telegram ID', 'Status', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>
        {/* Rows */}
        {filtered.map((u, idx) => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 36px', alignItems: 'center', padding: '10px 16px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--divider)' : 'none' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</p>
            </div>
            <Badge status={u.role} label={u.role.replace(/_/g, ' ')} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.dept}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: u.telegram_id ? 'var(--slate-600)' : 'var(--slate-300)' }}>{u.telegram_id ?? '—'}</span>
            <Badge status={u.status} />
            <RowMenu user={u} onAction={handleAction} />
          </div>
        ))}
        {!filtered.length && (
          <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No users match this filter.</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface-page)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total users in system</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{users.length}</span>
      </div>

      {/* Pending Invites section */}
      <PendingInvitesSection
        invites={invites}
        onRegenerate={inv => { showToast(`Invite regenerated for ${inv.email}. Share new link.`); }}
        onCancel={inv => { setInvites(is => is.filter(i => i.id !== inv.id)); showToast(`Invite for ${inv.email} cancelled.`, 'error'); }}
      />

      <CreateUserDrawer open={showCreate} onClose={() => setShowCreate(false)} actorRole="super_admin" />
    </>
  );
}

Object.assign(window, { UsersPage });
