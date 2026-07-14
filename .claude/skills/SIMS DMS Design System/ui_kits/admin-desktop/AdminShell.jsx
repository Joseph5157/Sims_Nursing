/* ──────────────────────────────────────────────────────────────
   Admin Desktop UI kit — shell: sidebar layout + inline SVG icons
   Mirrors the product's Layout.jsx / Sidebar.jsx desktop surface
   ────────────────────────────────────────────────────────────── */

// ── Minimal inline SVG icon set (Lucide stroke style, size=15 default) ──────
function Icon({ d, d2, circle, size = 15, strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      {circle && <circle cx={circle[0]} cy={circle[1]} r={circle[2]} />}
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  );
}

const ICONS = {
  dashboard:   { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', d2: 'M9 22V12h6v10' },
  users:       { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', circle: [9, 7, 4] },
  students:    { d: 'M22 10v6M2 10l10-5 10 5-10 5z', d2: 'M6 12v5c3 3 9 3 12 0v-5' },
  calendar:    { d: 'M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm0 6h18', d2: 'M16 2v4M8 2v4' },
  clipboard:   { d: 'M9 11l3 3 8-8', d2: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  alert:       { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01' },
  tag:         { d: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01' },
  swap:        { d: 'M21 9H3m0 0 4 4m-4-4 4-4M3 15h18m0 0-4 4m4-4-4-4' },
  mail:        { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6' },
  chart:       { d: 'M18 20V10M12 20V4M6 20v-6' },
  logout:      { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' },
  search:      { d: 'M21 21l-4.35-4.35', circle: [11, 11, 8] },
  x:           { d: 'M18 6 6 18M6 6l12 12' },
  copy:        { d: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2', d2: 'M8 2h8v4H8z' },
  refresh:     { d: 'M23 4v6h-6M1 20v-6h6', d2: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' },
  trash:       { d: 'M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6', d2: 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' },
  chevronDown: { d: 'M6 9l6 6 6-6' },
  check:       { d: 'M20 6L9 17l-5-5' },
};

function Ic({ name, size, strokeWidth }) {
  const ic = ICONS[name] ?? ICONS.x;
  return <Icon {...ic} size={size} strokeWidth={strokeWidth} />;
}

// ── Nav ─────────────────────────────────────────────────────────────────────
const NAV = [
  { key: 'dashboard',  label: 'Dashboard',    icon: 'dashboard' },
  { key: 'users',      label: 'Users',         icon: 'users' },
  { key: 'students',   label: 'Students',      icon: 'students' },
  { key: 'duties',     label: 'Duties',        icon: 'calendar' },
  { key: 'attendance', label: 'Attendance',    icon: 'clipboard' },
  { key: 'violations', label: 'Violations',    icon: 'alert' },
  { key: 'types',      label: 'Types',         icon: 'tag' },
  { key: 'cover',      label: 'Cover Shifts',  icon: 'swap' },
  { key: 'messages',   label: 'Messages',      icon: 'mail' },
  { key: 'reports',    label: 'Reports',       icon: 'chart' },
];

function SidebarItem({ icon, label, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 10px', borderRadius: 8, border: 'none',
        background: active ? 'rgba(59,130,246,0.15)' : hover ? 'rgba(255,255,255,0.05)' : 'none',
        color: active ? 'var(--blue-400)' : 'var(--slate-400)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'all var(--dur-fast)',
        fontFamily: 'var(--font-sans)',
      }}>
      <Ic name={icon} size={14} />
      {label}
    </button>
  );
}

function Sidebar({ active, onNav }) {
  return (
    <div style={{
      width: 220, flexShrink: 0, background: 'var(--surface-sidebar)',
      borderRight: '1px solid var(--slate-800)',
      display: 'flex', flexDirection: 'column', padding: '14px 12px',
      height: '100%', overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 16px', borderBottom: '1px solid var(--slate-800)', marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--brand-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎓</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>SIMS DMS</div>
          <div style={{ fontSize: 10, color: 'var(--slate-500)', marginTop: 1 }}>College of Pharmacy</div>
        </div>
      </div>
      {/* Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.map(n => (
          <SidebarItem key={n.key} icon={n.icon} label={n.label}
            active={active === n.key} onClick={() => onNav(n.key)} />
        ))}
      </div>
      {/* User */}
      <div style={{ borderTop: '1px solid var(--slate-800)', paddingTop: 12, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e3a5f', border: '1px solid var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--blue-400)', flexShrink: 0 }}>JK</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-200)', lineHeight: 1.2 }}>Joseph K</div>
            <div style={{ fontSize: 10, color: 'var(--slate-500)' }}>Super Admin</div>
          </div>
        </div>
        <button style={{ background: 'none', border: 'none', color: 'var(--slate-500)', cursor: 'pointer', padding: 4 }}>
          <Ic name="logout" size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 28px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface-card)',
      flexShrink: 0,
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Desktop frame ────────────────────────────────────────────────────────────
function AdminShell({ activeNav, onNav, title, subtitle, headerAction, children }) {
  return (
    <div style={{
      width: 1280, height: 720,
      display: 'flex', overflow: 'hidden',
      background: 'var(--surface-page)',
      fontFamily: 'var(--font-sans)',
      borderRadius: 12,
      boxShadow: '0 30px 80px -20px rgba(15,23,42,0.5)',
      border: '1px solid var(--slate-800)',
    }}>
      <Sidebar active={activeNav} onNav={onNav} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar title={title} subtitle={subtitle} action={headerAction} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--surface-page)', padding: '20px 28px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminShell, Ic, ICONS });
