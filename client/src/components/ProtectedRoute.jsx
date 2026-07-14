import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ user, isLoading, requiredRoles }) {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-[var(--surface-page)] to-[var(--surface-page)]">
        <div className="flex flex-col items-center gap-4">
          {/* Animated spinner */}
          <div className="w-10 h-10 border-4 border-[var(--color-blue-200)] border-t-[var(--brand)] rounded-full animate-spin" />
          {/* Status text */}
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">Verifying access</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Please wait…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If user must change password and is not already on the change-password page, redirect
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (requiredRoles) {
    const userRole = user.role?.toLowerCase();
    const hasAccess = requiredRoles.some(role => role.toLowerCase() === userRole);
    if (!hasAccess) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-[var(--surface-page)]">
          <div className="text-center">
            <div className="text-4xl mb-4">🔐</div>
            <p className="text-xl font-semibold text-[var(--danger)] mb-2">Access Denied</p>
            <p className="text-[var(--text-muted)] text-sm">Your role (<span className="font-medium">{user.role}</span>) doesn't have access to this page.</p>
          </div>
        </div>
      );
    }
  }

  return <Outlet />;
}
