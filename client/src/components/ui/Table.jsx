/**
 * Table — thin Mantine wrappers with same export names as the deleted Table.jsx.
 * This is the reference pattern for all Phase 3 page migrations.
 *
 * Mobile strategy: Table.ScrollContainer for horizontal scroll (the default for
 * pages with no explicit card-list layout). Pages that already have a
 * md:hidden / md:block card-list split can keep that — wrap only the desktop
 * table half with this Table component.
 *
 * Exports: Table, Th, Td, Tr, EmptyRow  (same names as before)
 */
import { Table as MTable, Paper, Text, Center, Stack, Button } from '@mantine/core';

/** Outer card shell + horizontal scroll container. */
export function Table({ children, minWidth = 500 }) {
  return (
    <Paper withBorder radius="md" className="overflow-hidden">
      <MTable.ScrollContainer minWidth={minWidth}>
        <MTable striped={false} highlightOnHover={false} withRowBorders={false}>
          {children}
        </MTable>
      </MTable.ScrollContainer>
    </Paper>
  );
}

/** Header cell — 10px uppercase, muted, slate-50 background. */
export function Th({ children, className }) {
  return (
    <MTable.Th
      className={['text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)] bg-[var(--surface-page)] whitespace-nowrap px-4 py-2.5', className].filter(Boolean).join(' ')}
    >
      {children}
    </MTable.Th>
  );
}

/** Data cell — 13px slate-700, bottom border for row dividers. */
export function Td({ children, className }) {
  return (
    <MTable.Td
      className={['text-[13px] text-[color:var(--text-secondary)] px-4 py-2.5 border-b border-b-[var(--divider)] whitespace-nowrap', className].filter(Boolean).join(' ')}
    >
      {children}
    </MTable.Td>
  );
}

/** Row — use for clickable rows (passes onClick + cursor). Keyboard-activatable when onClick is set. */
export function Tr({ children, onClick, className }) {
  return (
    <MTable.Tr
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      className={className}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? 'background-color 100ms' : undefined,
      }}
    >
      {children}
    </MTable.Tr>
  );
}

/** Empty / loading row — centred 📭 + message, spans all columns. */
export function EmptyRow({ cols, message = 'No records found.' }) {
  return (
    <MTable.Tr>
      <MTable.Td colSpan={cols} className="p-0 border-b-0">
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text className="text-[32px] opacity-40 leading-none">📭</Text>
            <Text size="sm" c="dimmed">{message}</Text>
          </Stack>
        </Center>
      </MTable.Td>
    </MTable.Tr>
  );
}

/** Shared visual content for a failed-request state — icon, message, optional Retry. */
function ErrorContent({ message = "Couldn't load this data.", onRetry }) {
  return (
    <Stack align="center" gap="xs">
      <Text className="text-[32px] opacity-40 leading-none">⚠️</Text>
      <Text size="sm" c="dimmed">{message}</Text>
      {onRetry && (
        <Button size="xs" variant="light" color="red" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Stack>
  );
}

/** Error row — same shape as EmptyRow, for when a query's isError is true. */
export function ErrorRow({ cols, message, onRetry }) {
  return (
    <MTable.Tr>
      <MTable.Td colSpan={cols} className="p-0 border-b-0">
        <Center py="xl">
          <ErrorContent message={message} onRetry={onRetry} />
        </Center>
      </MTable.Td>
    </MTable.Tr>
  );
}

/** Error block — non-table-row form, for card lists / non-table sections. */
export function ErrorBlock({ message, onRetry }) {
  return (
    <Center py="xl">
      <ErrorContent message={message} onRetry={onRetry} />
    </Center>
  );
}

export default Table;
