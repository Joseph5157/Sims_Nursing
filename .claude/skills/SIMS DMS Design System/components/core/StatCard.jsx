import React from 'react';

/* Exact hex values match client/src/components/ui/StatCard.jsx */
const ACCENTS = {
  blue:    { bar: '#3b82f6', bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  green:   { bar: '#10b981', bg: '#f0fdf4', text: '#065f46', border: '#d1fae5' },
  yellow:  { bar: '#f59e0b', bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  red:     { bar: '#ef4444', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  purple:  { bar: '#8b5cf6', bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
  default: { bar: '#94a3b8', bg: '#ffffff', text: '#0f172a', border: '#e2e8f0' },
};

/**
 * StatCard — a KPI tile with a colored left accent bar (RULE 5).
 * Number is 36px/800. Use in a 2- or 3-col grid.
 */
export function StatCard({ label, value, sub, accent = 'default', icon = null, style = {} }) {
  const c = ACCENTS[accent] ?? ACCENTS.default;
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${c.border}`,
        background: c.bg,
        padding: '14px 16px 14px 20px',
        overflow: 'hidden',
        minHeight: 96,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-stat)',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: c.bar, borderRadius: '14px 0 0 14px' }} />
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {icon && <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>}
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </p>
      <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: c.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value ?? '—'}
      </p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: c.text, opacity: 0.65, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

export default StatCard;
