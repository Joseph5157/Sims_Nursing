import React from 'react';

/**
 * Input — labelled text field. 44px tall, 14px radius, blue focus ring.
 * Supports an uppercase label, error state, and hint text.
 */
export function Input({ label, error, hint, style = {}, ...props }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)' }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </label>
      )}
      <input
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{
          height: 44,
          width: '100%',
          borderRadius: 'var(--radius-xl)',
          padding: '0 16px',
          fontSize: 14,
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-primary)',
          background: error ? '#fef2f7' : '#fff',
          border: `1px solid ${error ? 'var(--red-solid)' : focus ? 'var(--blue-500)' : 'var(--slate-200)'}`,
          boxShadow: focus ? `0 0 0 3px ${error ? 'rgba(239,68,68,0.15)' : 'var(--brand-ring)'}` : 'none',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
          ...style,
        }}
        {...props}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--red-solid)', fontWeight: 500 }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}

export default Input;
