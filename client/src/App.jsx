import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider, createTheme, Button } from '@mantine/core';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineBanner from './components/OfflineBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { useCurrentUser } from './hooks/useAuth';
import { initializeTheme, getEffectiveTheme } from './lib/theme';
import { ROLES } from './utils/constants';
import simsLogo from './assets/sims-logo.png';
import { APP_SHORT_NAME } from './utils/branding';

import LoginPage          from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import UsersPage          from './pages/admin/UsersPage';
import StudentsPage       from './pages/admin/StudentsPage';
import CalendarPage       from './pages/admin/CalendarPage';
import DutyTimingSettingsPage from './pages/admin/DutyTimingSettingsPage';
import DutySlotsPage      from './pages/admin/DutySlotsPage';
import AttendanceLivePage from './pages/admin/AttendanceLivePage';
import ViolationsPage     from './pages/admin/ViolationsPage';
import FlaggedViolationsPage from './pages/admin/FlaggedViolationsPage';
import ViolationTypesPage from './pages/admin/ViolationTypesPage';
import ReportsPage        from './pages/admin/ReportsPage';

import DashboardPage          from './pages/faculty/DashboardPage';
import SlotPickerPage         from './pages/faculty/SlotPickerPage';
import AllFacultyDutiesPage   from './pages/faculty/AllFacultyDutiesPage';
import AttendancePage         from './pages/faculty/AttendancePage';
import ViolationRecorderPage  from './pages/faculty/ViolationRecorderPage';

import MessagesPage     from './pages/shared/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import SuperAdminDashboardPage from './pages/super-admin/SuperAdminDashboardPage';
import AuditLogsPage    from './pages/super-admin/AuditLogsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});

// ── Mantine theme wired to the DS token ramp (source of truth: index.css @theme) ──
// Each tuple is a 10-shade ramp [0..9] built from the same hex values as the Tailwind
// @theme colors, so every Mantine component (Button / Alert / ActionIcon / Avatar / Menu.Item)
// renders in SIMS brand + status colors instead of Mantine's defaults. Shade index 6 == the
// DS "-600" step; index 5 == the "-solid"/"-500" step.
//
// ⚠️ SYNC REQUIREMENT: These hex values MUST stay in sync with client/src/index.css @theme.
// If brand or status colors change, update BOTH this object AND the @theme block. This is the
// one place visual drift between Mantine and Tailwind can reappear if not kept synchronized.
const mantineTheme = createTheme({
  primaryColor: 'blue',
  // Light: blue[6] #2563eb == --brand. Dark: blue[5] #3b82f6 == dark-mode --brand.
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  colors: {
    blue:   ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
    green:  ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
    red:    ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
    yellow: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
    gray:   ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
    // Secondary + tertiary M3-style accent roles — same hues already used in
    // --brand-gradient (indigo) and the super_admin badge (violet/purple).
    indigo: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'],
    violet: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
  },
  components: {
    // Mantine's size ramp tops out at md=42px; xs/sm are 30/36px — all below the
    // 44px touch-target floor. Enforce --control-min on every Button root so
    // Flag/Delete (xs), Check In (sm) and md actions clear the minimum app-wide.
    // Width is unaffected, so wide/fullWidth buttons look identical.
    Button: Button.extend({ styles: { root: { minHeight: 'var(--control-min)' } } }),
  },
});

function SplashScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--surface-page)]">
      <div className="flex flex-col items-center gap-5 animate-pulse">
        <img src={simsLogo} alt="SIMS" className="w-16 h-16 rounded-xl object-contain" />
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--text-primary)] tracking-tight">{APP_SHORT_NAME}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Loading…</p>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { data: user, isLoading } = useCurrentUser();

  const isFaculty = user?.role === ROLES.FACULTY;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Root redirect */}
      <Route path="/" element={
        isLoading ? <SplashScreen /> :
        !user ? <Navigate to="/login" replace /> :
        user.must_change_password ? <Navigate to="/change-password" replace /> :
        isFaculty ? <Navigate to="/faculty/dashboard" replace /> :
        <Navigate to="/admin/dashboard" replace />
      } />

      {/* Change password route — authenticated users only */}
      <Route element={<ProtectedRoute user={user} isLoading={isLoading} />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>

      {/* Shared authenticated routes */}
      <Route element={<ProtectedRoute user={user} isLoading={isLoading} />}>
        <Route path="/notifications"          element={<NotificationsPage user={user} />} />
      </Route>

      {/* Admin routes — Admin and Super Admin only */}
      <Route element={<ProtectedRoute user={user} isLoading={isLoading} requiredRoles={['admin', 'super_admin']} />}>
        <Route path="/admin/dashboard"        element={<AdminDashboardPage user={user} />} />
        <Route path="/admin/users"            element={<UsersPage user={user} />} />
        <Route path="/admin/students"         element={<StudentsPage user={user} />} />
        <Route path="/admin/calendar"         element={<CalendarPage user={user} />} />
        <Route path="/admin/duty-timing-settings" element={<DutyTimingSettingsPage user={user} />} />
        <Route path="/admin/duty-slots"       element={<DutySlotsPage user={user} />} />
        <Route path="/admin/attendance"       element={<AttendanceLivePage user={user} />} />
        <Route path="/admin/violations"       element={<ViolationsPage user={user} />} />
        <Route path="/admin/flagged-violations" element={<FlaggedViolationsPage user={user} />} />
        <Route path="/admin/violation-types"  element={<ViolationTypesPage user={user} />} />
        <Route path="/admin/messages"         element={<MessagesPage user={user} />} />
        <Route path="/admin/reports"          element={<ReportsPage user={user} />} />
      </Route>

      {/* Faculty routes — Faculty only */}
      <Route element={<ProtectedRoute user={user} isLoading={isLoading} requiredRoles={['faculty']} />}>
        <Route path="/faculty/dashboard"      element={<DashboardPage user={user} />} />
        <Route path="/faculty/slots"          element={<SlotPickerPage user={user} />} />
        <Route path="/faculty/all-duties"     element={<AllFacultyDutiesPage user={user} />} />
        <Route path="/faculty/attendance"     element={<AttendancePage user={user} />} />
        <Route path="/faculty/violations"     element={<ViolationRecorderPage user={user} />} />
        <Route path="/faculty/messages"       element={<MessagesPage user={user} />} />
      </Route>

      {/* Super Admin routes — Super Admin only */}
      <Route element={<ProtectedRoute user={user} isLoading={isLoading} requiredRoles={['super_admin']} />}>
        <Route path="/super-admin/dashboard"  element={<SuperAdminDashboardPage user={user} />} />
        <Route path="/super-admin/audit"      element={<AuditLogsPage user={user} />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [colorScheme, setColorScheme] = useState(getEffectiveTheme);

  useEffect(() => {
    initializeTheme();
    const handleThemeChange = () => setColorScheme(getEffectiveTheme());
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);

  return (
    <MantineProvider
      forceColorScheme={colorScheme}
      theme={mantineTheme}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PWAUpdatePrompt />
          <ErrorBoundary>
            <OfflineBanner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ErrorBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
