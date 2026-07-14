import React from 'react';

/**
 * MobileCard — the canonical list row (RULE 3). Primary line + secondary
 * meta, with badge/action/chevron on the right. Wrap a list of these in a
 * white rounded container; they self-divide with bottom borders.
 */
export function MobileCard({ primary, secondary, badge, action, onClick, showChevron = true }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        background: hover && onClick ? 'var(--slate-50)' : '#fff',
        borderBottom: '1px solid var(--divider)',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-sans)',
        transition: 'background-color var(--dur-fast)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {primary}
        </p>
        {secondary && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {secondary}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {badge}
        {action}
        {onClick && showChevron && <span style={{ color: 'var(--slate-300)', fontSize: 18 }}>›</span>}
      </div>
    </div>
  );
}

export default MobileCard;
