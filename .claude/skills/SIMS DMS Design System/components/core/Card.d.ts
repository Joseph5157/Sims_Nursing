import * as React from 'react';

export interface CardProps {
  /** Optional tinted header bar title. */
  title?: string;
  /** Node aligned to the right of the header (link, button, badge). */
  headerAction?: React.ReactNode;
  /** Pad the body 16px. Set false for edge-to-edge lists. @default true */
  padded?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export interface CardHeaderProps {
  children?: React.ReactNode;
  /** Right-aligned action node. */
  action?: React.ReactNode;
}

export interface CardBodyProps {
  children?: React.ReactNode;
  /** @default true */
  padded?: boolean;
}

/** Standard white surface — 14px radius, hairline border, soft shadow. */
export function Card(props: CardProps): JSX.Element;
/** Tinted header bar — 13px semibold + optional right action. */
export function CardHeader(props: CardHeaderProps): JSX.Element;
/** Card body — 16px padding by default. */
export function CardBody(props: CardBodyProps): JSX.Element;
export default Card;
