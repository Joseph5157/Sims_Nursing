export default function Skeleton({ className = '', width = '100%', height = '16px' }) {
  return (
    <div
      className={`bg-[var(--border)] rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

// Export row skeleton for tables
export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr className="border-b border-[var(--divider)] hover:bg-[var(--surface-page)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height="16px" width={Math.random() * 40 + 60 + '%'} />
        </td>
      ))}
    </tr>
  );
}

// Export card skeleton for mobile
export function CardSkeleton() {
  return (
    <div className="border-b border-[var(--divider)] py-3 px-4">
      <Skeleton height="18px" width="60%" className="mb-2" />
      <Skeleton height="14px" width="80%" className="mb-3" />
      <Skeleton height="14px" width="50%" />
    </div>
  );
}
