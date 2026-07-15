// Shared client-facing user serializer — strips password_hash and other internal
// fields. Used by every endpoint that returns a user object (GET /users/me,
// login, change-password, profile updates, admin user management) so they can
// never drift out of sync with each other on which fields are exposed.
const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  sims_id: u.sims_id,
  email: u.email,
  phone: u.phone,
  role: u.role,
  department: u.department,
  designation: u.designation,
  title: u.title,
  avatar: u.avatar,
  telegram_id: u.telegram_id,
  telegram_verified: u.telegram_verified,
  status: u.status,
  approved_at: u.approved_at,
  created_at: u.created_at,
  activation_notification_failed: u.activation_notification_failed,
});

module.exports = { safeUser };
