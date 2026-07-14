export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  FACULTY: 'faculty',
};

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  // Admin
  ADMIN_DASHBOARD:        '/admin/dashboard',
  ADMIN_USERS:            '/admin/users',
  ADMIN_STUDENTS:         '/admin/students',
  ADMIN_CALENDAR:         '/admin/calendar',
  ADMIN_DUTY_TIMING_SETTINGS: '/admin/duty-timing-settings',
  ADMIN_DUTY_SLOTS:       '/admin/duty-slots',
  ADMIN_ATTENDANCE:       '/admin/attendance',
  ADMIN_VIOLATIONS:       '/admin/violations',
  ADMIN_FLAGGED_VIOLATIONS: '/admin/flagged-violations',
  ADMIN_VIOLATION_TYPES:  '/admin/violation-types',
  ADMIN_MESSAGES:         '/admin/messages',
  ADMIN_REPORTS:          '/admin/reports',
  // Faculty
  FACULTY_DASHBOARD:      '/faculty/dashboard',
  FACULTY_SLOTS:          '/faculty/slots',
  FACULTY_ALL_DUTIES:     '/faculty/all-duties',
  FACULTY_ATTENDANCE:     '/faculty/attendance',
  FACULTY_VIOLATIONS:     '/faculty/violations',
  FACULTY_MESSAGES:       '/faculty/messages',
  // Super Admin
  SUPER_ADMIN_DASHBOARD:  '/super-admin/dashboard',
  SUPER_ADMIN_AUDIT:      '/super-admin/audit',
};

/* Status badge classes — DS token-aligned tint + ink pairs */
export const STATUS_COLORS = {
  active:           'bg-emerald-tint text-emerald-text',
  inactive:         'bg-slate-100 text-slate-500',
  pending:          'bg-amber-tint text-amber-text',
  pending_telegram: 'bg-cyan-tint text-cyan-text',
  invited:          'bg-blue-50 text-blue-700',
  invite_expired:   'bg-red-tint text-red-text',
  scheduled:        'bg-blue-100 text-blue-700',
  completed:        'bg-emerald-tint text-emerald-text',
  absent:           'bg-red-tint text-red-text',
  reassigned:       'bg-indigo-bg text-indigo-text',
  normal:           'bg-emerald-tint text-emerald-text',
  late:             'bg-amber-tint text-amber-text',
  hidden:           'bg-slate-100 text-slate-500',
  flagged:          'bg-amber-tint text-amber-text',
  not_checked_in:   'bg-slate-100 text-slate-500',
  upcoming:         'bg-blue-50 text-blue-700',
  checked_in:       'bg-blue-100 text-blue-700',
  checked_out:      'bg-emerald-tint text-emerald-text',
};

export const ROLE_COLORS = {
  super_admin: 'bg-purple-tint text-purple-text',
  admin:       'bg-amber-tint text-amber-text',
  faculty:     'bg-blue-100 text-blue-700',
};
