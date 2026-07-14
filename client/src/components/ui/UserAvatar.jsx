import { getAvatarOption } from '../../utils/avatars';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// Renders a user's selected predefined avatar icon, or an initials fallback
// (gradient circle) when no avatar is set. Reused anywhere a user needs a
// circular identity glyph — currently the sidebar profile card.
export default function UserAvatar({ user, size = 32, className = '' }) {
  const option = getAvatarOption(user?.avatar);

  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center text-white font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: option?.gradient ?? 'linear-gradient(135deg, #3b82f6, #6366f1)',
        fontSize: Math.round(size * 0.375),
      }}
    >
      {option ? <option.Icon size={Math.round(size * 0.6)} stroke={2} /> : getInitials(user?.name)}
    </div>
  );
}
