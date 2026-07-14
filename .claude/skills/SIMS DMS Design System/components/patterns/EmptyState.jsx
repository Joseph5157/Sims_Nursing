import React from 'react';

/**
 * EmptyState — centered placeholder for empty lists (RULE 7). Big emoji,
 * title, subtitle, optional action.
 */
export function EmptyState({ emoji = '📭', title, subtitle, action, style = {} }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', fontFamily: 'var(--font-sans)', ...style }}>
      <p style={{ margin: 0, fontSize: 48, marginBottom: 12, lineHeight: 1 }}>{emoji}</p>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</p>
      {subtitle && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{subtitle}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
