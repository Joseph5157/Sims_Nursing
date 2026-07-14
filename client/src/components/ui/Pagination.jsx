import { Group, Text } from '@mantine/core';

function getPages(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (page <= 4)       return [1, 2, 3, 4, 5, '...', total];
  if (page >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', page - 1, page, page + 1, '...', total];
}

const btnBase = {
  height: 44, minWidth: 44, border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', cursor: 'pointer',
  fontSize: 'var(--text-card)', fontWeight: 500,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 10px', transition: 'background-color 0.1s, color 0.1s',
  fontFamily: 'inherit',
};

export default function Pagination({ meta, page, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  const from  = (page - 1) * meta.limit + 1;
  const to    = Math.min(page * meta.limit, meta.total);
  const pages = getPages(page, meta.pages);

  return (
    <Group justify="space-between" pt="md" wrap="wrap" gap="xs">
      <Text size="xs" c="dimmed">Showing {from}–{to} of {meta.total}</Text>
      <Group gap={8}>
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          style={{
            ...btnBase,
            background: page <= 1 ? 'var(--surface-page)' : 'var(--surface-card)',
            color: page <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: page <= 1 ? 'default' : 'pointer',
          }}
        >
          ← Prev
        </button>

        {pages.map((p, i) =>
          p === '...'
            ? (
              <span key={`ellipsis-${i}`} style={{
                ...btnBase, border: 'none', background: 'none',
                color: 'var(--text-muted)', cursor: 'default',
              }}>
                …
              </span>
            )
            : (
              <button
                key={p}
                onClick={() => onPage(p)}
                style={{
                  ...btnBase,
                  background: p === page ? 'var(--brand)' : 'var(--surface-card)',
                  color: p === page ? 'white' : 'var(--text-secondary)',
                  borderColor: p === page ? 'var(--brand)' : 'var(--border)',
                  fontWeight: p === page ? 700 : 500,
                }}
              >
                {p}
              </button>
            )
        )}

        <button
          disabled={page >= meta.pages}
          onClick={() => onPage(page + 1)}
          style={{
            ...btnBase,
            background: page >= meta.pages ? 'var(--surface-page)' : 'var(--surface-card)',
            color: page >= meta.pages ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: page >= meta.pages ? 'default' : 'pointer',
          }}
        >
          Next →
        </button>
      </Group>
    </Group>
  );
}
