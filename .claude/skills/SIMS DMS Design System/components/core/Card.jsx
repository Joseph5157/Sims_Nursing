import React from 'react';

/**
 * Card — the standard white surface: 14px radius, hairline border, soft shadow.
 * Mirrors Layout.jsx's Card/CardHeader/CardBody exports.
 * Optional `title` renders a tinted header bar; otherwise children fill the body.
 */
export function Card({ title, headerAction, children, padded = true, style = {} }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {title && <CardHeader action={headerAction}>{title}</CardHeader>}
      <CardBody padded={padded}>{children}</CardBody>
    </div>
  );
}

/** Tinted header bar — 13px semibold label + optional right-aligned action. */
export function CardHeader({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#334155' }}>{children}</p>
      {action}
    </div>
  );
}

/** Card body — 16px padding by default. Set `padded={false}` for edge-to-edge lists. */
export function CardBody({ children, padded = true }) {
  return <div style={{ padding: padded ? 16 : 0 }}>{children}</div>;
}

export default Card;
