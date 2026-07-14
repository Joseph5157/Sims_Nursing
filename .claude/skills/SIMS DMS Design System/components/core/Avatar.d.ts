import * as React from 'react';

export interface AvatarProps {
  /** Full name — first two initials are shown. */
  name?: string;
  /** @default 'default' (38px) */
  size?: 'sm' | 'default' | 'lg';
  /** Use the ringed dark-sidebar treatment. @default false */
  onDark?: boolean;
  style?: React.CSSProperties;
}

/** Initials avatar — gradient fill on light, ringed blue on dark. */
export function Avatar(props: AvatarProps): JSX.Element;
export default Avatar;
