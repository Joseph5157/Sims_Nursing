# Major Features Implementation Strategy

Based on the audit document and current progress, here's the comprehensive plan for tackling the five major features in optimal order.

## Priority & Sequencing

**Recommended Implementation Order:**
1. **Feature 6: Dark Mode** (6 hours) — Foundation for theming, impacts all components
2. **Feature 7: Accessibility Audit** (4 hours) — Quick wins with high impact, improves UX across the board
3. **Feature 8: Mobile Navigation Drawer** (3 hours) — Improves mobile UX significantly
4. **Feature 9: Notification Bell** (4 hours) — Real-time feature, depends on backend support
5. **Feature 10: PWA Offline Support** (6 hours) — Complex but builds on existing cache infrastructure

**Total estimated time: 23 hours**

---

## Feature 6: Dark Mode (6 hours)

### Architecture
- Create `client/src/lib/theme.js` with `getTheme()`, `setTheme(theme)`, and `getSystemPreference()` functions
- Use localStorage key `"app-theme"` with values: `'light'`, `'dark'`, or `'system'`
- Apply class to `<html>` element: `dark` class when dark mode is active
- Respect system preference (`prefers-color-scheme`) when theme is `'system'`

### Files to Create
**client/src/lib/theme.js:**
- `getTheme()` — reads localStorage, defaults to 'system'
- `setTheme(theme)` — writes to localStorage and applies class to html element
- `getSystemPreference()` — checks `window.matchMedia('(prefers-color-scheme: dark)')`
- `getEffectiveTheme()` — resolves 'system' to actual 'light' or 'dark'
- `initializeTheme()` — applies theme on app startup
- Event listener for system preference changes using `matchMedia().addListener()`

### Files to Modify
**client/src/App.jsx:**
- Import theme functions
- Add `useEffect` hook that calls `initializeTheme()` on mount
- Add listener for system preference changes
- Listen to localStorage 'storage' event for cross-tab theme sync

**client/src/components/Sidebar.jsx (or main nav component):**
- Add theme toggle button in the sidebar footer or header
- Button shows current theme (☀️ for light, 🌙 for dark, 🖥️ for system)
- onClick handler calls `setTheme()` and cycles through options
- Tooltip text: "Theme: Light" / "Theme: Dark" / "Theme: System"

**client/src/index.css:**
- Add CSS variables for dark mode (already partially exists based on summary)
- Use `:root` for light mode, `html.dark` selector for dark mode
- Define dark versions: `--color-slate-900` → `#0f172a` in light, `#e2e8f0` in dark (inverted)
- All component colors should use variables, not hardcoded values
- Text colors, backgrounds, borders all inverted
- Focus rings maintain visibility in both modes

### Dark Mode Color Strategy
For each existing color variable, define its dark mode equivalent:
- Primary backgrounds: light mode `#ffffff`, dark mode `#0f172a`
- Secondary backgrounds: light mode `#f8fafc`, dark mode `#1e293b`
- Text primary: light mode `#1e293b`, dark mode `#f1f5f9`
- Text muted: light mode `#64748b`, dark mode `#94a3b8`
- Borders: light mode `#e2e8f0`, dark mode `#334155`

### Testing Checklist
- [ ] Toggle theme and verify all pages update immediately
- [ ] Reload page and verify theme persists
- [ ] Open in incognito, set theme, verify it doesn't affect other windows
- [ ] Set system preference to dark, open with 'system' theme, verify dark mode applies
- [ ] Change system preference while app is open, verify theme updates
- [ ] Test all pages in both light and dark modes for readability
- [ ] Verify focus indicators visible in both modes
- [ ] Test with browser DevTools dark mode emulation

---

## Feature 7: Accessibility Audit (4 hours)

### Changes by Component Category

**Icon Buttons (buttons with only icons, no text):**
- Add `aria-label` to all buttons with icons only
- Examples:
  - Close buttons: `aria-label="Close dialog"`
  - Menu toggles: `aria-label="Open menu"`
  - Theme toggle: `aria-label="Toggle dark mode"`
  - Search clear: `aria-label="Clear search"`

**Files to scan:** Button.jsx (add prop), all pages with icon buttons, components using icons

**Toast Notifications:**
- Add `role="alert"` to toast container
- Add `aria-live="polite"` (auto-dismiss toasts) or `aria-live="assertive"` (important alerts)
- Add `aria-atomic="true"` to announce full message
- Toast component at `client/src/components/ui/Toast.jsx`

**Error Messages & Status Updates:**
- Add `role="alert"` to error containers in forms
- Add `aria-live="assertive"` to error messages
- Example in Input.jsx: wrap error text with role and aria attributes
- Apply to form validation errors, ConfirmDialog errors

**Focus Indicators:**
- All interactive elements must have visible focus ring
- Minimum contrast ratio: 3:1 between focus color and element
- Add `:focus-visible` pseudo-selector to all interactive elements
- Remove `outline: none` without replacing with alternative focus style
- Test with Tab key navigation: every interactive element should be reachable

**Semantic HTML:**
- Ensure all buttons are `<button>` or `<a>` tags (not divs with click handlers)
- Use `<nav>` for navigation regions
- Use `<main>` for main content area
- Use `<header>`, `<footer>`, `<section>` appropriately
- Tables should have `<thead>`, `<tbody>` with proper structure

**Link & Button Distinction:**
- `<a>` tags for navigation (href attribute)
- `<button>` tags for actions (onclick)
- Links should never use `role="button"` and vice versa

### Files to Modify

**client/src/components/ui/Button.jsx:**
- Add optional `aria-label` prop
- Render aria-label if provided
- Add `:focus-visible` styling with 2px ring

**client/src/components/ui/Input.jsx:**
- Wrap error message with `role="alert"` and `aria-live="assertive"`
- Add `aria-invalid="true"` when error present
- Add `aria-describedby` linking to error message

**client/src/components/ui/Toast.jsx:**
- Add `role="alert"` to toast container div
- Add `aria-live="polite"` (for success) or `aria-live="assertive"` (for errors)
- Add `aria-atomic="true"`

**client/src/components/ui/Modal.jsx:**
- Add `role="dialog"` to modal container
- Add `aria-modal="true"`
- Add `aria-labelledby` pointing to modal title element

**client/src/components/Layout.jsx (Sidebar):**
- Wrap sidebar with `<nav role="navigation">`
- Add `aria-label="Navigation"` or `aria-label="Main navigation"`

**client/src/App.jsx:**
- Wrap main content with `<main role="main">`

### Audit Checklist
- [ ] All icon-only buttons have aria-label
- [ ] All toasts have role="alert" and aria-live
- [ ] All error messages have role="alert"
- [ ] All form inputs have aria-invalid when error present
- [ ] All interactive elements show focus ring on Tab
- [ ] All pages pass axe DevTools audit (install browser extension)
- [ ] All pages navigable with keyboard only (Tab, Shift+Tab, Enter, Space, Escape)
- [ ] Test with screen reader (NVDA on Windows, Narrator, JAWS if available)
- [ ] Test heading hierarchy (no skipped levels like h1 → h3)
- [ ] All images/icons have alt text or aria-label

---

## Feature 8: Mobile Navigation Drawer (3 hours)

### Architecture
- Create bottom sheet navigation for mobile devices (shown when menu toggled on small screens)
- Keep existing sidebar visible on desktop (md and above)
- Bottom sheet slides up from bottom with overlay
- Touch-friendly: 50px+ tap targets, full-width buttons
- Escape key or overlay click closes drawer

### Files to Create

**client/src/components/MobileNav.jsx:**
- Bottom sheet component that only renders on `md:hidden`
- Overlay div with `position: fixed, inset: 0, background: rgba(0,0,0,0.5)`
- Drawer div with `position: fixed, bottom: 0, left: 0, right: 0, max-height: 80vh, border-radius: var(--radius-2xl) var(--radius-2xl) 0 0`
- Animation: translate from `translateY(100%)` to `translateY(0)` on open
- Animated close with `translateY(100%)`
- Drag to close support (optional, advanced)

**Structure:**
```
- Header with title and close button
- Navigation items (same links as desktop sidebar)
- Settings section (theme toggle, logout)
- Close on item click (except for expandable sections)
```

### Files to Modify

**client/src/components/Sidebar.jsx:**
- Hide on mobile (add `hidden md:flex`)
- Add mobile menu button in top nav that toggles drawer

**client/src/components/Layout.jsx:**
- Add state `const [mobileNavOpen, setMobileNavOpen] = useState(false)`
- Render mobile menu button in header (three horizontal lines icon)
- Render `<MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />`
- onClick handler: `setMobileNavOpen(!mobileNavOpen)`

**client/src/index.css:**
- Add animation: `@keyframes slideUp { from: { transform: translateY(100%); opacity: 0; } to: { transform: translateY(0); opacity: 1; } }`
- Duration: 300ms, timing: ease-out

### Implementation Details

**Mobile Menu Button:**
- Position: top-right of header on mobile
- Size: 40px × 40px (touch target)
- Icon: three horizontal lines (hamburger)
- Only shows on screens < md (768px)

**Drawer Contents:**
- Header with title "Menu" and close icon (✕)
- Each navigation section with consistent spacing (16px padding)
- Links use same color as desktop (text-slate-700, hover:bg-slate-100)
- All interactive areas: min 44px height
- Logout button at bottom with danger styling

**Animations:**
- Drawer slides up: 300ms
- Overlay fade in: 300ms
- Click outside: close drawer
- Escape key: close drawer

### Testing Checklist
- [ ] Mobile menu button shows on screens < 768px
- [ ] Clicking menu button opens drawer
- [ ] Clicking item in drawer navigates and closes drawer
- [ ] Clicking outside drawer closes it
- [ ] Pressing Escape closes drawer
- [ ] Animation is smooth (60fps)
- [ ] All tap targets are 44px minimum
- [ ] Text is readable (not cut off)
- [ ] Drawer doesn't cover critical content

---

## Feature 9: Notification Bell (4 hours)

### Architecture
- Real-time notifications using EventSource (Server-Sent Events) or WebSocket
- Backend endpoint: `GET /api/notifications/stream` (EventSource) or `/ws/notifications` (WebSocket)
- Frontend bell icon in header with unread count badge
- Click bell opens dropdown/panel showing last 10 notifications
- Mark as read on click
- Connection management: auto-reconnect, backoff strategy

### Files to Create

**client/src/hooks/useNotifications.js:**
```
Exports:
- useNotifications() — main hook for notifications
- Returns: { notifications, unreadCount, isConnected }
- Opens EventSource on mount
- Auto-reconnects with exponential backoff
- Listens to 'notification' events
- Stores in React Query cache
```

**client/src/components/NotificationBell.jsx:**
- Bell icon (🔔) in top-right of header
- Red badge showing unread count (if > 0)
- Click opens dropdown panel
- Panel shows:
  - Header with "Notifications" title
  - List of last 10 notifications with timestamps
  - Each notification: title, message, timestamp, "Mark as read" link
  - Empty state: "No notifications"
  - "View all" link to notifications page

**client/src/pages/NotificationsPage.jsx:**
- Full page list of all notifications (paginated)
- Columns: Type, Message, Date, Actions (Mark Read, Delete)
- Filters: All, Unread, by Type
- Bulk actions: Mark all as read, Delete read

### Files to Modify

**client/src/components/Layout.jsx (Header):**
- Add `<NotificationBell />` component next to user menu
- Position: right side, before user avatar

**client/src/utils/api.js (if not already set up):**
- Ensure API client is configured for CORS
- Set headers for authentication (Bearer token)

### Notification Data Structure
```
{
  id: string,
  type: 'duty_assigned' | 'cover_request' | 'violation' | 'message' | 'system',
  title: string,
  message: string,
  createdAt: ISO timestamp,
  readAt: ISO timestamp | null,
  actionUrl?: string,  // Link to related page
  metadata?: object   // Additional data (duty_id, cover_request_id, etc.)
}
```

### EventSource Implementation
```javascript
const eventSource = new EventSource('/api/notifications/stream', {
  headers: { Authorization: `Bearer ${token}` }
});

eventSource.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
  // Add to React Query cache
});

// Auto-reconnect with exponential backoff on error
eventSource.onerror = () => {
  eventSource.close();
  setTimeout(() => { /* reconnect */ }, backoffTime);
};
```

### Testing Checklist
- [ ] Bell icon shows in header on all pages
- [ ] Unread count badge displays correctly
- [ ] Clicking bell opens dropdown
- [ ] Notifications appear in real-time (test with curl: `curl -N http://localhost:3000/api/notifications/stream`)
- [ ] Mark as read updates immediately
- [ ] Unread count decreases when marking as read
- [ ] Connection re-establishes after network interruption
- [ ] Notifications persist across page refreshes (stored in React Query cache)
- [ ] Empty state shows when no notifications
- [ ] Timestamps are formatted correctly (relative: "5 minutes ago")

---

## Feature 10: PWA Offline Support (6 hours)

### Architecture
- Service Worker: caches API responses and assets
- Offline detection: `useOnline()` hook and banner
- Offline mode: displays data from cache, disables mutations
- Sync queue: stores mutations made offline, replays when online
- Cache strategy: NetworkFirst for API, CacheFirst for assets

### Files to Create

**client/public/service-worker.js:**
```javascript
- Cache versions: CACHE_NAME = 'app-v1'
- Install: cache assets (index.html, main.js, main.css)
- Activate: clean old cache versions
- Fetch listener:
  - API calls (*/api/*): NetworkFirst strategy
    - Try network first
    - Fall back to cache
    - Network succeeds: update cache
  - Assets (*.js, *.css, images): CacheFirst strategy
    - Return from cache if exists
    - Fetch from network, cache response
  - HTML: NetworkFirst with 3-second timeout
```

**client/src/hooks/useOnline.js:**
```
Exports: useOnline() hook
Returns: { isOnline, wasOffline }
- Listens to 'online' and 'offline' events
- Tracks when app transitions online
- Useful for showing offline banner
```

**client/src/hooks/useSyncQueue.js:**
```
Exports: useSyncQueue() hook
Returns: { queue, addToQueue, processQueue }
- Stores mutations that failed due to offline
- Replay when online
- Uses localStorage: 'sync-queue'
```

**client/src/components/OfflineBanner.jsx:**
- Fixed banner at top of page when offline
- Message: "You're offline. Changes will sync when connection is restored."
- Yellow/amber background
- Dismiss button (✕)
- Auto-hide when online
- Only shows on mobile (md:hidden) to save space on desktop

### Files to Modify

**client/src/App.jsx:**
- Register service worker on mount:
  ```javascript
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.error('SW registration failed', err))
  }
  ```
- Import and render `<OfflineBanner />` at top level
- Pass `useOnline()` state to banner

**client/src/hooks/useStudents.js, useUsers.js, etc.:**
- Modify mutations to handle offline:
  ```javascript
  onError: async (err) => {
    if (!navigator.onLine) {
      addToQueue({ type: 'promoteStudent', id, data });
      toast({ message: 'Saved offline. Will sync when online.' });
      return; // Don't show error
    }
    // Normal error handling
  }
  ```

**client/src/components/ui/Toast.jsx:**
- Add offline-specific styling (amber background for offline messages)
- Longer auto-dismiss for offline messages (6 seconds instead of 3)

### Service Worker Cache Strategy Details

**NetworkFirst (API):**
1. Try to fetch from network
2. If network fails or 3-second timeout, use cache
3. On success, update cache
4. Use for: `/api/` endpoints

**CacheFirst (Assets):**
1. Check cache first
2. If not in cache, fetch from network
3. Cache the response
4. Use for: `.js`, `.css`, `.png`, `.jpg`, `.svg`

**NetworkFirst with timeout (HTML):**
1. Fetch from network with 3-second timeout
2. If timeout or failure, use cache
3. Use for: `index.html`

### Testing Checklist
- [ ] Service Worker registers on app load (check DevTools Application tab)
- [ ] Assets cached (check Storage → Cache Storage)
- [ ] Open DevTools, toggle offline mode (check Network tab "Offline")
- [ ] App loads from cache when offline (no network errors)
- [ ] Pages display previously cached data
- [ ] Form submissions show "Saved offline" message
- [ ] Offline banner appears at top of page
- [ ] Navigate between pages while offline (should work)
- [ ] Go online, verify banner disappears
- [ ] Queued mutations replay when online (check API calls)
- [ ] Service Worker update flow works (new version installed in background)
- [ ] Old cache versions cleaned up on update

---

## Implementation Sequence & Dependency Map

```
Feature 6: Dark Mode (standalone)
  ↓
Feature 7: Accessibility Audit (builds on dark mode)
  ↓
Feature 8: Mobile Navigation Drawer (builds on dark mode)
  ↓
Feature 9: Notification Bell (standalone, uses new useNotifications hook)
  ↓
Feature 10: PWA Offline Support (depends on cache infrastructure from Feature 1)
```

## Key Integration Points

**Dark Mode → All Components:**
- Every component color must use CSS variables
- index.css provides all color definitions for light and dark modes
- No hardcoded hex colors after Feature 6

**Accessibility → All Components:**
- Every button gets aria-label if icon-only
- Every form input gets aria-invalid, aria-describedby
- Every alert/toast gets role="alert" and aria-live
- Every interactive element gets visible focus ring

**Mobile Navigation → Layout:**
- Sidebar hidden on mobile, drawer shown instead
- Consistent navigation between desktop and mobile
- Same route links in both drawer and sidebar

**Notification Bell → Header:**
- Lives in Layout header next to user menu
- Badge shows unread count from useNotifications hook
- Click opens dropdown with recent notifications

**Offline Support → All Mutations:**
- Every useMutation needs offline handling
- Show "Saved offline" message instead of error
- Queue mutation for replay when online
- useOnline hook available throughout app

---

## Implementation Status

- [x] Feature 6: Dark Mode ✓ COMPLETE
- [x] Feature 7: Accessibility Audit ✓ COMPLETE
- [x] Feature 8: Mobile Navigation Drawer ✓ COMPLETE
- [x] Feature 9: Notification Bell ✓ COMPLETE
- [x] Feature 10: PWA Offline Support ✓ COMPLETE

**All features completed successfully! 🎉**
