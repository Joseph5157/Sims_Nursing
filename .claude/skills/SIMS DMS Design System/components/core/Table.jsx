import React from 'react';

/**
 * Table — the product's data table shell (overflow-x-auto, rounded, shadow).
 * Compose with Th, Td, Tr, EmptyRow.
 * Mirrors client/src/components/ui/Table.jsx exactly.
 */
export function Table({ children, style = {} }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)', background: '#fff', ...style }}>
      <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
        {children}
      </table>
    </div>
  );
}

/** Table header cell — 10px bold uppercase, slate-50 background. */
export function Th({ children, style = {}, hidden }) {
  if (hidden) return null;
  return (
    <th style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f8fafc', padding: '10px 16px', textAlign: 'left', whiteSpace: 'nowrap', ...style }}>
      {children}
    </th>
  );
}

/** Table data cell — 13px slate-700. */
export function Td({ children, style = {} }) {
  return (
    <td style={{ fontSize: 13, color: '#334155', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', ...style }}>
      {children}
    </td>
  );
}

/** Table row — blue hover when clickable. */
export function Tr({ children, onClick, style = {} }) {
  const [hover, setHover] = React.useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && onClick ? 'rgba(239,246,255,0.5)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.1s',
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

/** Empty state row — centered 📭 icon + message. */
export function EmptyRow({ cols, message = 'No records found.' }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '48px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 32, opacity: 0.4 }}>📭</span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{message}</span>
        </div>
      </td>
    </tr>
  );
}

export default Table;
