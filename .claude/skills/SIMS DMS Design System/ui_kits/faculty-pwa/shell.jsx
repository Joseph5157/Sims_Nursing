/* ───────────────────────────────────────────────────────────────
   Faculty PWA UI kit — phone shell, bottom tab bar, mock data
   ─────────────────────────────────────────────────────────────── */

// ── Mock data ───────────────────────────────────────────────────
const MOCK = {
  user: { name: 'Priya Sharma', role: 'faculty', dept: 'Pharmaceutics' },
  todaySlot: { session_type: 'morning', status: 'scheduled' },
  upcoming: [
    { id: 1, date: '14 Mar', session: 'afternoon', status: 'scheduled' },
    { id: 2, date: '19 Mar', session: 'morning', status: 'scheduled' },
    { id: 3, date: '26 Mar', session: 'morning', status: 'cover_pending' },
  ],
  messages: [
    { id: 1, subject: 'Scheduling window opens tomorrow', read: false },
    { id: 2, subject: 'Reminder: check-in by 9:15 AM', read: false },
    { id: 3, subject: 'March duty roster published', read: true },
  ],
  students: [
    { id: 1, reg: 'SIMS-2024-018', name: 'Rahul Menon', course: 'B.Pharm · 2nd yr' },
    { id: 2, reg: 'SIMS-2024-042', name: 'Sneha Pillai', course: 'B.Pharm · 1st yr' },
    { id: 3, reg: 'SIMS-2023-007', name: 'Arjun Das', course: 'D.Pharm · 2nd yr' },
    { id: 4, reg: 'SIMS-2024-090', name: 'Fatima Noor', course: 'B.Pharm · 3rd yr' },
  ],
  violationTypes: [
    { id: 1, name: 'Late to class', fine: 50 },
    { id: 2, name: 'Improper uniform', fine: 100 },
    { id: 3, name: 'Mobile phone use', fine: 200 },
    { id: 4, name: 'Missing ID card', fine: 50 },
    { id: 5, name: 'Misconduct', fine: 0 },
  ],
};

// ── Status bar (iOS-style) ──────────────────────────────────────
function StatusBar({ dark }) {
  const color = dark ? '#f8fafc' : '#0f172a';
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px 0 26px', flexShrink: 0, color, fontFamily: 'var(--font-sans)' }}>
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12 }}>●●●</span>
        <span style={{ fontSize: 13 }}>📶</span>
        <span style={{ fontSize: 13 }}>🔋</span>
      </div>
    </div>
  );
}

// ── Phone frame ─────────────────────────────────────────────────
function PhoneFrame({ children, statusDark }) {
  return (
    <div style={{
      width: 390, height: 760, background: '#fff', borderRadius: 44,
      border: '11px solid #0b1120', boxShadow: '0 30px 80px -20px rgba(15,23,42,0.5)',
      overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      <StatusBar dark={statusDark} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

// ── Bottom tab bar (matches Sidebar.jsx mobile nav) ─────────────
const TABS = [
  { key: 'dashboard', label: 'Dashboard', emoji: '📊' },
  { key: 'slots', label: 'My Slots', emoji: '📆' },
  { key: 'attendance', label: 'Attendance', emoji: '✅' },
  { key: 'violations', label: 'Violations', emoji: '⚠️' },
  { key: 'messages', label: 'Messages', emoji: '✉️' },
];

function BottomTabBar({ active, onChange }) {
  return (
    <nav style={{
      display: 'flex', height: 60, background: 'var(--slate-900)',
      borderTop: '1px solid var(--slate-800)', flexShrink: 0,
    }}>
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2, background: 'none', border: 'none',
            borderTop: on ? '2px solid var(--blue-500)' : '2px solid transparent',
            color: on ? 'var(--blue-400)' : 'var(--slate-500)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 8, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'color 0.15s',
          }}>
            <span style={{ fontSize: 18 }}>{t.emoji}</span>
            <span>{t.label.split(' ')[0]}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Scrollable page body with the product's mobile padding ──────
function PageBody({ children, header }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--surface-page)' }}>
      {header}
      <div style={{ padding: '4px 16px 24px' }}>{children}</div>
    </div>
  );
}

function MobilePageHeader({ title, subtitle }) {
  return (
    <div style={{ padding: '14px 16px 12px', background: 'var(--surface-page)', borderBottom: '1px solid var(--border)' }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h1>
      {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

Object.assign(window, { MOCK, PhoneFrame, BottomTabBar, PageBody, MobilePageHeader, StatusBar });
