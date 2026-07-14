import React from 'react';

/**
 * Select — labelled native dropdown styled to match Input. Pass `options`
 * as [{ value, label }] or plain strings.
 */
export function Select({ label, error, options = [], placeholder, style = {}, ...props }) {
  const [focus, setFocus] = React.useState(false);
  const norm = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)' }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          style={{
            height: 44,
            width: '100%',
            borderRadius: 'var(--radius-xl)',
            padding: '0 38px 0 16px',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-primary)',
            background: '#fff',
            border: `1px solid ${error ? 'var(--red-solid)' : focus ? 'var(--blue-500)' : 'var(--slate-200)'}`,
            boxShadow: focus ? `0 0 0 3px var(--brand-ring)` : 'none',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            boxSizing: 'border-box',
            transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
            ...style,
          }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {norm.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--slate-400)', fontSize: 12 }}>▾</span>
      </div>
      {error && <span style={{ fontSize: 11, color: 'var(--red-solid)', fontWeight: 500 }}>{error}</span>}
    </div>
  );
}

export default Select;
