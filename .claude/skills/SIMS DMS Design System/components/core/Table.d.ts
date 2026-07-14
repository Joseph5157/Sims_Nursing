import * as React from 'react';

export interface TableProps { children?: React.ReactNode; style?: React.CSSProperties; }
export interface ThProps { children?: React.ReactNode; style?: React.CSSProperties; /** Hide this column (for responsive breakpoints). */ hidden?: boolean; }
export interface TdProps { children?: React.ReactNode; style?: React.CSSProperties; }
export interface TrProps { children?: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; }
export interface EmptyRowProps {
  /** Number of columns to span. */
  cols: number;
  /** @default 'No records found.' */
  message?: string;
}

/**
 * Data table shell. Compose with Th, Td, Tr, EmptyRow.
 * @startingPoint section="Core" subtitle="Data table — Th, Td, Tr, EmptyRow" viewport="700x300"
 */
export function Table(props: TableProps): JSX.Element;
/** Header cell — 10px uppercase, slate-50 bg. Pass `hidden` to hide a column (mobile responsive). */
export function Th(props: ThProps): JSX.Element | null;
/** Data cell — 13px slate-700. */
export function Td(props: TdProps): JSX.Element;
/** Row — blue hover tint when `onClick` is set. */
export function Tr(props: TrProps): JSX.Element;
/** Centered 📭 empty state spanning all columns. */
export function EmptyRow(props: EmptyRowProps): JSX.Element;
export default Table;
