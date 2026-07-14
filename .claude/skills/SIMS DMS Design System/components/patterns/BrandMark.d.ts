import * as React from 'react';

export interface BrandMarkProps {
  /** @default 'default' (40px). `lg` is the login hero size. */
  size?: 'sm' | 'default' | 'lg';
  /** Lock up with the "SIMS DMS" wordmark. @default false */
  showWordmark?: boolean;
  /** Add the brand drop-glow (login screen). @default false */
  glow?: boolean;
  style?: React.CSSProperties;
}

/** The SIMS DMS app mark — graduation cap on the blue→indigo gradient tile. */
export function BrandMark(props: BrandMarkProps): JSX.Element;
export default BrandMark;
