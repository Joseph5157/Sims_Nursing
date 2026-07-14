import React from 'react';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const SIZES = { sm: 30, default: 38, lg: 48 };

/**
 * Avatar — initials badge. `onDark` uses the sidebar's ringed style;
 * otherwise a blue→indigo gradient fill.
 */
export function Avatar({ name, size = 'default', onDark = false, style = {} }) {
  const px = SIZES[size] ?? SIZES.default;
  const base = {
    width: px,
    height: px,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: Math.round(px * 0.36),
    flexShrink: 0,
    ...style,
  };
  const skin = onDark
    ? { background: '#1e3a5f', border: '1px solid var(--blue-600)', color: 'var(--blue-400)' }
    : { background: 'var(--brand-gradient)', color: '#fff' };
  return <div style={{ ...base, ...skin }}>{initials(name)}</div>;
}

export default Avatar;
