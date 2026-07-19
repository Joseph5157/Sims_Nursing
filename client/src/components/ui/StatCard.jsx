import { useState, useEffect } from 'react';

// Cards use a white (elevated) surface so they pop against the tinted page canvas
// (--page-canvas). The accent lives in the left bar, the border, and the value color —
// not a full tinted fill, which blended into the cool canvas for the cool hues (blue/indigo).
// `fill` is the faint tonal background used when the `tonal` prop is set (soft
// filled card); otherwise cards sit on the white `bg` surface.
const ACCENTS = {
  green:   { bar: 'var(--color-emerald-600)', bg: 'var(--surface-card)', fill: 'var(--color-emerald-bg)', text: 'var(--color-emerald-text)', border: 'var(--color-emerald-tint)' },
  yellow:  { bar: 'var(--color-amber-600)',   bg: 'var(--surface-card)', fill: 'var(--color-amber-bg)',   text: 'var(--color-amber-600)',   border: 'var(--color-amber-tint)' },
  red:     { bar: 'var(--color-red-600)',     bg: 'var(--surface-card)', fill: 'var(--color-red-bg)',     text: 'var(--color-red-600)',     border: 'var(--color-red-tint)' },
  blue:    { bar: 'var(--color-blue-600)',      bg: 'var(--surface-card)', fill: 'var(--color-blue-50)',    text: 'var(--color-blue-700)',     border: 'var(--color-blue-200)' },
  indigo:  { bar: 'var(--color-indigo-600)',  bg: 'var(--surface-card)', fill: 'var(--color-indigo-bg)',  text: 'var(--color-indigo-solid)',  border: 'var(--color-indigo-border)' },
  purple:  { bar: 'var(--color-purple-solid)',  bg: 'var(--surface-card)', fill: 'var(--color-purple-bg)',  text: 'var(--color-purple-text)',  border: 'var(--color-purple-tint)' },
  /* Neutral fallback (unused by the dashboards now that cards are always-colored) — a
     tinted surface tier so a stray zero-value card still reads as part of the system. */
  default: { bar: 'var(--border-strong)', bg: 'var(--color-surface-container-low)', fill: 'var(--color-surface-container-low)', text: 'var(--text-primary)', border: 'var(--border)' },
};

export default function StatCard({ label, value, sub, accent = 'default', icon, onClick, compact = false, tonal = false }) {
  const c = ACCENTS[accent] ?? ACCENTS.default;
  // Only positive numbers get the count-up animation; anything else (strings,
  // zero, null) is shown directly as derived state.
  const isAnimated = typeof value === 'number' && value !== 0;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (!isAnimated) return;
    const duration = 600;
    const start = performance.now();
    let raf;
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setAnimated(Math.round(eased * value)); // setState inside rAF callback is fine
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, isAnimated]);

  const display = isAnimated ? animated : (value ?? '—');

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      className={`relative rounded-[var(--radius-xl)] overflow-hidden min-w-0 ${compact ? '' : 'min-h-24'} flex flex-col justify-start ${compact ? 'gap-0.5' : 'gap-2'} font-[var(--font-sans)] ${onClick ? 'transition-transform hover:-translate-y-px cursor-pointer' : ''}`}
      style={{
        border: `1px solid ${c.border}`,
        backgroundColor: tonal ? c.fill : c.bg,
        padding: compact ? '10px 12px 10px 16px' : '14px 16px 14px 20px',
        boxShadow: 'var(--shadow-stat)',
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{
          backgroundColor: c.bar,
          borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)',
        }}
      />

      {/* Label */}
      <p
        className="m-0 text-[length:var(--text-micro)] font-[600] uppercase tracking-[0.06em] flex items-center gap-1"
        style={{ color: 'var(--color-slate-500)' }}
      >
        {icon && <span className="text-[13px] shrink-0">{icon}</span>}
        <span className="leading-[1.3]">{label}</span>
      </p>

      {/* Value */}
      <p
        className={`m-0 truncate font-[800] leading-none tracking-[var(--tracking-tight)] ${compact ? 'text-[length:var(--text-h2)]' : 'text-[length:var(--text-stat)]'}`}
        style={{ color: c.text }}
        title={typeof display === 'string' ? display : undefined}
      >
        {display}
      </p>

      {/* Sub */}
      {sub && (
        <p
          className="m-0 mt-0.5 text-[length:var(--text-micro)] opacity-65"
          style={{ color: c.text }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
