// Professional bust-with-collar illustrations for the two faculty avatars, drawn
// in the same 24x24/stroke-2 convention as the Tabler icons used for Admin/Super
// Admin (see ../../../utils/avatars.js) so all four sit together as one icon
// family. Rendered with stroke="currentColor" so they inherit the container's
// `text-white`, keeping them legible on the gradient circle in both light and
// dark theme.
export function MaleFacultyIcon({ size = 24, stroke = 2, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21v-1.5A5.5 5.5 0 0 1 10.5 14h3A5.5 5.5 0 0 1 19 19.5V21" />
      <path d="M9.5 14 12 17l2.5-3" />
      <path d="M12 17v3.2" />
    </svg>
  );
}

export function FemaleFacultyIcon({ size = 24, stroke = 2, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M8.3 4.8a3.7 3.7 0 1 1 7.4 0c.3 1.8-.1 3.4-1 4.6a3.7 3.7 0 0 1 -5.4 0c-.9-1.2-1.3-2.8-1-4.6z" />
      <path d="M5 21v-1.5A5.5 5.5 0 0 1 10.5 14h3A5.5 5.5 0 0 1 19 19.5V21" />
      <path d="M10 14c.7 1 1.3 1.6 2 1.6s1.3-.6 2-1.6" />
    </svg>
  );
}
