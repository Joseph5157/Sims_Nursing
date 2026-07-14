import React from 'react';

/**
 * SectionHeader — the uppercase muted label that precedes every list/section
 * (RULE 4). Optional right-aligned action.
 */
export function SectionHeader({ title, action, style = {} }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: 8, marginTop: 20, fontFamily: 'var(--font-sans)', ...style }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </p>
      {action}
    </div>
  );
}

export default SectionHeader;
