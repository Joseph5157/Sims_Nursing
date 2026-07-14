import React from 'react';

const SIZES = { sm: 28, default: 40, lg: 72 };
const RADII = { sm: 8, default: 12, lg: 20 };

/**
 * BrandMark — the SIMS DMS app mark: a graduation cap on the blue→indigo
 * gradient tile, optionally locked up with the "SIMS DMS" wordmark.
 */
export function BrandMark({ size = 'default', showWordmark = false, glow = false, style = {} }) {
  const px = SIZES[size] ?? SIZES.default;
  const tile = (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: RADII[size] ?? 12,
        background: 'var(--brand-gradient)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(px * 0.45),
        flexShrink: 0,
        boxShadow: glow ? 'var(--shadow-brand)' : 'none',
      }}
    >
      🎓
    </div>
  );
  if (!showWordmark) return <span style={style}>{tile}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-sans)', ...style }}>
      {tile}
      <span style={{ fontSize: px > 40 ? 18 : 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>SIMS DMS</span>
    </span>
  );
}

export default BrandMark;
