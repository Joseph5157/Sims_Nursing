const TONES = {
  info:     { bg: 'var(--color-blue-50)',     border: 'var(--color-blue-200)',      accent: 'var(--color-blue-500)',     title: 'var(--color-blue-800)',     body: 'var(--color-blue-700)' },
  success:  { bg: 'var(--color-emerald-bg)',  border: 'var(--color-emerald-border)', accent: 'var(--color-emerald-solid)', title: 'var(--color-emerald-text)', body: 'var(--color-emerald-700)' },
  warning:  { bg: 'var(--color-amber-bg)',    border: 'var(--color-amber-border)',   accent: 'var(--color-amber-solid)',  title: 'var(--color-amber-text)',   body: 'var(--color-amber-700)' },
  danger:   { bg: 'var(--color-red-bg)',      border: 'var(--color-red-border)',     accent: 'var(--color-red-solid)',    title: 'var(--color-red-text)',     body: 'var(--color-red-600)' },
  telegram: { bg: 'var(--color-cyan-bg)',     border: 'var(--color-cyan-border)',    accent: 'var(--color-cyan-solid)',   title: 'var(--color-cyan-text)',    body: 'var(--color-cyan-600)' },
};

export default function Alert({ tone = 'info', icon, title, children, action, onClick, className = '' }) {
  const t = TONES[tone] ?? TONES.info;
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2.5 rounded-[var(--radius-lg)] px-3.5 py-3 font-[var(--font-sans)] ${className}`}
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderLeft: `3px solid ${t.accent}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {icon && <span className="text-[17px] shrink-0 leading-[1.2]">{icon}</span>}
      <div className="flex-1 min-w-0">
        {title && (
          <p className="m-0 text-[length:var(--text-card)] font-[var(--weight-bold)]" style={{ color: t.title, marginBottom: children ? 2 : 0 }}>
            {title}
          </p>
        )}
        {children && (
          <p className="m-0 text-[length:var(--text-small)] leading-[var(--leading-snug)]" style={{ color: t.body }}>
            {children}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
