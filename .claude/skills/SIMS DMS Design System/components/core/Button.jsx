import React from 'react';

const VARIANTS = {
  primary:   { background: 'var(--blue-600)', color: '#fff', border: '1px solid transparent', boxShadow: 'var(--shadow-stat)', hoverBg: 'var(--blue-700)', activeBg: 'var(--blue-800)' },
  secondary: { background: '#fff', color: 'var(--slate-700)', border: '1px solid var(--slate-200)', hoverBg: 'var(--slate-50)', activeBg: 'var(--slate-100)' },
  danger:    { background: 'var(--red-solid)', color: '#fff', border: '1px solid transparent', boxShadow: 'var(--shadow-stat)', hoverBg: '#dc2626', activeBg: '#b91c1c' },
  success:   { background: 'var(--emerald-solid)', color: '#fff', border: '1px solid transparent', boxShadow: 'var(--shadow-stat)', hoverBg: '#059669', activeBg: '#047857' },
  ghost:     { background: 'transparent', color: 'var(--slate-600)', border: '1px solid transparent', hoverBg: 'var(--slate-100)', activeBg: 'var(--slate-200)' },
  outline:   { background: 'var(--blue-50)', color: 'var(--blue-700)', border: '1px solid var(--blue-200)', hoverBg: 'var(--blue-100)', activeBg: 'var(--blue-100)' },
};

const SIZES = {
  xs:      { height: 28, padding: '0 10px', fontSize: 11, borderRadius: 'var(--radius-md)' },
  sm:      { height: 32, padding: '0 12px', fontSize: 12, borderRadius: 'var(--radius-lg)' },
  default: { minHeight: 44, padding: '0 16px', fontSize: 13, borderRadius: 'var(--radius-xl)' },
  lg:      { height: 48, padding: '0 24px', fontSize: 15, borderRadius: 'var(--radius-xl)' },
};

/**
 * Button — the product's primary action control.
 * 6 variants × 4 sizes. Default size respects the 44px mobile tap target.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'default',
  loading = false,
  icon = null,
  disabled = false,
  style = {},
  ...props
}) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  const s = SIZES[size] ?? SIZES.default;
  const isDisabled = disabled || loading;
  const [hover, setHover] = React.useState(false);

  return (
    <button
      disabled={isDisabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        lineHeight: 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        userSelect: 'none',
        transition: 'background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast)',
        background: hover && !isDisabled ? v.hoverBg : v.background,
        color: v.color,
        border: v.border,
        boxShadow: v.boxShadow ?? 'none',
        ...s,
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: 14, height: 14, flexShrink: 0,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'simsdms-spin 0.6s linear infinite',
          }}
        />
      ) : icon ? (
        <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export default Button;
