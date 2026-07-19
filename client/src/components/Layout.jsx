import { useState, useEffect } from 'react';
import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import simsLogo from '../assets/sims-logo.png';
import { APP_SHORT_NAME } from '../utils/branding';
import {
  AppShell, Drawer, Group, Box, Text, Stack, Title, Paper,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard, IconUsers, IconSchool, IconCalendar,
  IconCalendarEvent, IconClipboardCheck, IconAlertTriangle,
  IconTag, IconMail, IconChartBar,
  IconBolt, IconFileText, IconLogout, IconMenu2, IconClock, IconFlag,
} from '@tabler/icons-react';
import { useLogout } from '../hooks/useAuth';
import { cycleTheme, getTheme, getThemeIcon, getThemeLabel } from '../lib/theme';
import { ROUTES, ROLES } from '../utils/constants';
import NotificationBell from './NotificationBell';
import ProfileDrawer from './ProfileDrawer';
import UserAvatar from './ui/UserAvatar';
import classes from './Layout.module.css';

// ── Nav link definitions ───────────────────────────────────────────────────────

// Nav is grouped into labeled sections for hierarchy in the sidebar.
const adminNav = [
  { group: 'Overview', items: [
    { to: ROUTES.ADMIN_DASHBOARD,       label: 'Dashboard',          Icon: IconLayoutDashboard },
  ]},
  { group: 'People', items: [
    { to: ROUTES.ADMIN_USERS,           label: 'Users',              Icon: IconUsers },
    { to: ROUTES.ADMIN_STUDENTS,        label: 'Students',           Icon: IconSchool },
  ]},
  { group: 'Duties', items: [
    { to: ROUTES.ADMIN_CALENDAR,        label: 'Calendar',           Icon: IconCalendar },
    { to: ROUTES.ADMIN_DUTY_SLOTS,      label: 'Duty Slots',         Icon: IconCalendarEvent },
    { to: ROUTES.ADMIN_ATTENDANCE,      label: 'Live Attendance',    Icon: IconClipboardCheck },
    { to: ROUTES.ADMIN_DUTY_TIMING_SETTINGS, label: 'Duty Timing Settings', Icon: IconClock },
  ]},
  { group: 'Discipline', items: [
    { to: ROUTES.ADMIN_VIOLATIONS,      label: 'Student Violations', Icon: IconAlertTriangle },
    { to: ROUTES.ADMIN_FLAGGED_VIOLATIONS, label: 'Flagged Violations', Icon: IconFlag },
    { to: ROUTES.ADMIN_VIOLATION_TYPES, label: 'Violation Types',    Icon: IconTag },
  ]},
  { group: 'Workspace', items: [
    { to: ROUTES.ADMIN_MESSAGES,        label: 'Messages',           Icon: IconMail },
    { to: ROUTES.ADMIN_REPORTS,         label: 'Reports',            Icon: IconChartBar },
  ]},
];

const facultyNav = [
  { group: 'Overview', items: [
    { to: ROUTES.FACULTY_DASHBOARD,      label: 'Dashboard',          Icon: IconLayoutDashboard },
  ]},
  { group: 'Duties', items: [
    { to: ROUTES.FACULTY_SLOTS,          label: 'My Slots',           Icon: IconCalendarEvent },
    { to: ROUTES.FACULTY_ALL_DUTIES,     label: 'All Faculty Duties', Icon: IconCalendar },
    { to: ROUTES.FACULTY_ATTENDANCE,     label: 'Attendance',         Icon: IconClipboardCheck },
  ]},
  { group: 'Activity', items: [
    { to: ROUTES.FACULTY_VIOLATIONS,     label: 'Student Violations', Icon: IconAlertTriangle },
    { to: ROUTES.FACULTY_MESSAGES,       label: 'Messages',           Icon: IconMail },
  ]},
];

const superAdminNavExtra = [
  { group: 'System', items: [
    { to: ROUTES.SUPER_ADMIN_DASHBOARD, label: 'SA Dashboard', Icon: IconBolt },
    { to: ROUTES.SUPER_ADMIN_AUDIT,     label: 'Audit Logs',   Icon: IconFileText },
  ]},
];

function getNav(role) {
  if (role === ROLES.FACULTY)     return facultyNav;
  if (role === ROLES.SUPER_ADMIN) return [...adminNav, ...superAdminNavExtra];
  return adminNav;
}

// ── Bottom tab bar — 4 pinned routes per role ──────────────────────────────────

const facultyBottomTabs = [
  { to: ROUTES.FACULTY_DASHBOARD,      label: 'Home',       Icon: IconLayoutDashboard },
  { to: ROUTES.FACULTY_SLOTS,          label: 'Slots',      Icon: IconCalendarEvent },
  { to: ROUTES.FACULTY_ATTENDANCE,     label: 'Attendance', Icon: IconClipboardCheck },
  { to: ROUTES.FACULTY_VIOLATIONS,     label: 'Violations', Icon: IconAlertTriangle },
];

const adminBottomTabs = [
  { to: ROUTES.ADMIN_DASHBOARD,   label: 'Home',       Icon: IconLayoutDashboard },
  { to: ROUTES.ADMIN_STUDENTS,    label: 'Students',   Icon: IconSchool },
  { to: ROUTES.ADMIN_VIOLATIONS,  label: 'Violations', Icon: IconAlertTriangle },
  { to: ROUTES.ADMIN_ATTENDANCE,  label: 'Attendance', Icon: IconClipboardCheck },
];

function getBottomTabs(role) {
  if (role === ROLES.FACULTY) return facultyBottomTabs;
  return adminBottomTabs;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRoleLabel(role) {
  if (role === ROLES.SUPER_ADMIN) return 'Super Admin';
  if (role === ROLES.ADMIN)       return 'Admin Panel';
  if (role === ROLES.FACULTY)     return 'Faculty Portal';
  return '';
}

// ── Sidebar nav link ───────────────────────────────────────────────────────────

function NavItem({ to, label, Icon, onClick }) {
  return (
    <RouterNavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `${classes.navItem} ${isActive ? classes.navItemActive : ''}`
      }
    >
      <Icon size={18} strokeWidth={1.75} className="shrink-0" />
      <span>{label}</span>
    </RouterNavLink>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function Layout({ user, children }) {
  const [navOpened, { open: openNav, close: closeNav }] = useDisclosure(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const logout   = useLogout();
  const [, setThemeState] = useState(() => getTheme());

  useEffect(() => {
    function handleThemeChange() { setThemeState(getTheme()); }
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);
  const nav        = getNav(user?.role);
  const bottomTabs = getBottomTabs(user?.role);

  const sidebarContent = (
    <div className={classes.sidebar}>
      {/* Brand */}
      <div className={classes.brand}>
        <img src={simsLogo} alt="SIMS" className={classes.brandMark} />
        <div className={classes.brandText}>
          <span className={classes.brandName}>{APP_SHORT_NAME}</span>
          <span className={classes.brandRole}>{getRoleLabel(user?.role)}</span>
        </div>
      </div>

      {/* Grouped nav */}
      <nav className={classes.navScroll}>
        {nav.map((section) => (
          <div key={section.group} className={classes.navGroup}>
            <p className={classes.navGroupLabel}>{section.group}</p>
            {section.items.map((link) => (
              <NavItem key={link.to} {...link} onClick={closeNav} />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer — user card + actions */}
      <div className={classes.sidebarFooter}>
        <button
          type="button"
          onClick={() => { setProfileOpen(true); closeNav(); }}
          className={classes.userCard}
          aria-label="Open profile settings"
        >
          <UserAvatar user={user} size={32} />
          <div className={classes.userInfo}>
            <span className={classes.userName}>{user?.name}</span>
            <span className={classes.userRole}>{getRoleLabel(user?.role)}</span>
          </div>
        </button>
        <div className={classes.footerActions}>
          <button type="button" onClick={cycleTheme} className={classes.themeBtn}>
            <span className="text-[13px]">{getThemeIcon()}</span>
            {getThemeLabel()}
          </button>
          <button type="button" onClick={() => logout.mutate()} className={classes.logoutBtn} aria-label="Log out">
            <IconLogout size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile nav drawer — slides in from left when Menu is tapped */}
      <Drawer
        opened={navOpened}
        onClose={closeNav}
        position="left"
        size={240}
        withCloseButton={false}
        padding={0}
        styles={{
          content: { backgroundColor: '#0f172a' },
          body:    { padding: 0, height: '100%' },
        }}
        hiddenFrom="sm"
      >
        {sidebarContent}
      </Drawer>

      <AppShell
        navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: true } }}
        padding={0}
      >
        {/* Sidebar — desktop only (≥ 640px) */}
        <AppShell.Navbar p={0} style={{ border: 'none' }}>
          {sidebarContent}
        </AppShell.Navbar>

        {/* Mobile top header — hamburger + title + notifications */}
        <div className={classes.mobileHeader}>
          <button
            onClick={openNav}
            className="w-11 h-11 flex items-center justify-center rounded-lg bg-transparent border-none cursor-pointer text-[var(--text-primary)] hover:bg-[var(--color-slate-100)] transition-colors"
            aria-label="Open menu"
          >
            <IconMenu2 size={22} strokeWidth={1.75} />
          </button>
          <span className="text-sm font-bold text-[color:var(--text-primary)] tracking-[-0.01em]">
            {APP_SHORT_NAME}
          </span>
          <NotificationBell role={user?.role} />
        </div>

        {/* Desktop top header — visible on desktop only (≥ 640px) */}
        <div className={classes.desktopHeader}>
          <NotificationBell role={user?.role} />
        </div>

        {/* Main content */}
        <AppShell.Main
          style={{
            background: 'var(--page-canvas)',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            minHeight: '100dvh',
          }}
        >
          <div key={location.pathname} className={classes.pageContent}>
            {children}
          </div>
        </AppShell.Main>
      </AppShell>

      {/* ── Bottom tab bar — fixed, mobile only (hidden ≥ 640px via CSS) ── */}
      <div className={classes.bottomBar}>
        {bottomTabs.map((tab) => (
          <RouterNavLink
            key={tab.to}
            to={tab.to}
            className="flex-1 no-underline"
          >
            {({ isActive }) => (
              <div
                className="flex flex-col items-center justify-center h-full gap-[3px] px-0.5 transition-colors duration-150"
                style={{
                  color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                  borderTop: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                }}
              >
                <tab.Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className={`text-[length:var(--text-micro)] tracking-[0.01em] ${isActive ? 'font-semibold' : 'font-normal'}`}>
                  {tab.label}
                </span>
              </div>
            )}
          </RouterNavLink>
        ))}
      </div>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
    </>
  );
}

// ── Shared layout exports ──────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }) {
  return (
    <Stack align="center" gap={4} py={0} mb={10}
      className="border-b border-b-[var(--border)] text-center"
    >
      <Title order={2} className="text-[length:var(--text-h2)] font-bold leading-[1.3]">
        {title}
      </Title>
      {subtitle && (
        <Text size="xs" c="dimmed">{subtitle}</Text>
      )}
      {action && <Box mt={6}>{action}</Box>}
    </Stack>
  );
}

export function Card({ children, className = '' }) {
  return (
    <Paper withBorder radius="md" className={`overflow-hidden ${className}`}>
      {children}
    </Paper>
  );
}

export function CardHeader({ children, action }) {
  return (
    <Box
      px="md" py="sm"
      className="border-b border-b-[var(--border)] bg-[var(--surface-page)]"
    >
      <Group justify="space-between" gap="sm">
        <Text size="sm" fw={600} className="text-[color:var(--text-secondary)]">{children}</Text>
        {action}
      </Group>
    </Box>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <Box p="md" className={className}>
      {children}
    </Box>
  );
}
