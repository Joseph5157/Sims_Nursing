# SIMS DMS — QUICK REFERENCE GUIDE
**Print this. Stick on your monitor.**

---

## THE 5 CRITICAL ISSUES (Fix These First)

| # | Issue | Where | Fix | Time |
|---|-------|-------|-----|------|
| 1.1 | **Hydration Flash** — Blank screen then redirect on page load | `App.jsx`, `useAuth.js` | Add sessionStorage caching in useCurrentUser hook | 30 min |
| 1.2 | **Modal Padding Missing** — Forms cramped against edges | `Modal.jsx` line ~30 | Change `p-0 gap-0` → `px-6 py-5 gap-4` | 5 min |
| 1.3 | **Hardcoded Color** — Faculty Dashboard has `#eef2ff` instead of CSS variable | `DashboardPage.jsx` line ~72 | Replace `#eef2ff` → `var(--color-indigo-100)` | 10 min |
| 1.4 | **Loading Spinner Minimal** — Confuses users on slow networks | `ProtectedRoute.jsx` line ~8 | Add context text + gradient background | 15 min |
| 2.1 | **Typography Chaos** — Page titles different sizes across app | Multiple pages + `index.css` | Create typography scale classes in CSS | 25 min |

---

## THE NEXT 5 HIGH-PRIORITY ISSUES

| # | Issue | Where | Fix | Time |
|---|-------|-------|-----|------|
| 2.2 | **No Skeleton Loaders** — "Loading…" text looks unfinished | All data pages | Create Skeleton, CardSkeleton, TableRowSkeleton components | 45 min |
| 2.3 | **Button Sizing** — xs/sm buttons only 28-32px (tap target too small) | `Button.jsx` sizes | Ensure all buttons min-h-[44px] on mobile | 10 min |
| 3.1 | **Input Error Color** — Uses undefined `--red-solid` CSS variable | `Input.jsx`, `index.css` | Change to `red-600` and add proper color tokens | 5 min |
| 3.2 | **Select Inconsistent** — Select height/styling doesn't match Input | `Select.jsx` | Update to match Input: h-11, focus ring, error state | 15 min |
| 3.3 | **Alert Colors** — Uses `var(--blue-700)` which doesn't exist | `Alert.jsx`, `index.css` | Use `var(--color-blue-700)` and verify all tokens exist | 10 min |

---

## WHAT CAUSES THE "FLASH"?

```
User opens app
    ↓
useCurrentUser() hook starts loading (no cached data)
    ↓
AppRoutes sees isLoading=true, returns null
    ↓
White screen (FLASH!) ← This is what users see
    ↓
API response arrives after 200-500ms
    ↓
User data set, component re-renders
    ↓
Redirect to /admin/dashboard
    ↓
Correct page appears
```

**Solution**: Cache user in sessionStorage, restore on app load with `initialData`.

---

## ISSUE 1.1 — HYDRATION FLASH (Step by Step)

### Step 1: Create `client/src/lib/auth.js`
```javascript
export function saveUserToStorage(user) {
  if (user) {
    sessionStorage.setItem('sims_user_cached', JSON.stringify(user));
  }
}

export function loadUserFromStorage() {
  const cached = sessionStorage.getItem('sims_user_cached');
  return cached ? JSON.parse(cached) : null;
}

export function clearUserStorage() {
  sessionStorage.removeItem('sims_user_cached');
}
```

### Step 2: Update `client/src/hooks/useAuth.js`
In `useCurrentUser()`:
- Add `import { loadUserFromStorage, saveUserToStorage } from '../lib/auth';`
- Add `initialData: loadUserFromStorage(),` to useQuery options
- In queryFn onSuccess, call `saveUserToStorage(res.data)`

In `useLogin()`:
- Add `saveUserToStorage(res.data);` in onSuccess

In `useLogout()`:
- Add `clearUserStorage();` in onSuccess

### Step 3: Test
1. Login
2. Refresh page
3. Should NOT show blank screen or loading spinner
4. Should immediately show dashboard (from cache)
5. API will silently update in background

---

## FILE LOCATIONS CHEAT SHEET

```
client/src/
├── components/
│   ├── Layout.jsx ..................... Page wrapper + header
│   ├── Sidebar.jsx ................... Navigation
│   ├── ProtectedRoute.jsx ............ Auth guard (shows loading)
│   └── ui/
│       ├── Button.jsx ............... ← Fix button sizes
│       ├── Input.jsx ................ ← Fix error color
│       ├── Select.jsx ............... ← Update to match Input
│       ├── Modal.jsx ................ ← Fix padding
│       ├── Alert.jsx ................ ← Fix color vars
│       ├── Badge.jsx ................ ✓ Working
│       ├── Table.jsx ................ ✓ Working
│       ├── StatCard.jsx ............. ✓ Working
│       └── Skeleton.jsx ............. ← CREATE NEW
│
├── pages/
│   ├── auth/
│   │   └── LoginPage.jsx ............ ✓ Working
│   ├── admin/
│   │   ├── AdminDashboardPage.jsx ... ← Fix title size
│   │   └── StudentsPage.jsx ......... ← Add skeleton loader
│   └── faculty/
│       └── DashboardPage.jsx ........ ← Fix #eef2ff color
│
├── hooks/
│   └── useAuth.js ................... ← Fix hydration
│
├── lib/
│   ├── utils.ts .................... (cn utility exists)
│   └── auth.js ..................... ← CREATE NEW
│
└── index.css ........................ ← Add color tokens + typography scale
```

---

## QUICK FIX CHECKLIST

### Morning Session (2 hours)
- [ ] Create `lib/auth.js`
- [ ] Update `hooks/useAuth.js` (useCurrentUser, useLogin, useLogout)
- [ ] Fix `Modal.jsx` padding
- [ ] Fix `DashboardPage.jsx` hardcoded color
- [ ] Test login flow → refresh → no flash

### Afternoon Session (1.5 hours)
- [ ] Fix `ProtectedRoute.jsx` loading UI
- [ ] Update `index.css` color tokens for error states
- [ ] Fix `Input.jsx` error color
- [ ] Fix `Select.jsx` to match Input
- [ ] Test all forms

### Next Day (2 hours)
- [ ] Create `Skeleton.jsx` component
- [ ] Update 3-4 pages with skeleton loaders
- [ ] Test with network throttling

---

## CSS VARIABLES YOU NEED TO KNOW

```css
/* Colors */
--text-primary: #0f172a;
--text-secondary: #475569;
--surface-card: #ffffff;
--border: #e2e8f0;

/* Status colors */
--color-emerald-solid: #10b981;
--color-amber-solid: #f59e0b;
--color-red-solid: #ef4444;

/* Spacing */
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;

/* Typography */
--text-display: 28px;
--text-page-title: 18px;
--text-card-lg: 15px;
--text-card: 13px;
--text-small: 12px;

/* Radius */
--radius-lg: 12px;
--radius-xl: 14px;
--radius-2xl: 16px;
```

---

## RESPONSIVE BREAKPOINTS

```
Mobile:     0-767px    (min-h-[44px], full width)
Tablet:     768-1023px (padding increase, 2-col grids)
Desktop:    1024px+    (sidebar visible, 3-4 col grids)
```

Use `hidden md:flex` for desktop-only, `md:hidden` for mobile-only.

---

## COMMAND CHEAT SHEET

```bash
# Development
cd client && npm run dev
# → Open http://localhost:5173

# Testing
cd client && npm run build
# → Check for errors before deploying

# Check CSS compilation
npm run build 2>&1 | grep -i "error\|warning"

# View source maps (to debug CSS)
# Open DevTools → Sources → index.css
```

---

## BEFORE/AFTER TEST CASES

### Test 1: Hydration Flash
**Before**: Refresh after login → blank screen → redirect  
**After**: Refresh after login → immediate dashboard load

### Test 2: Modal Forms
**Before**: Open Add User modal → form inputs cramped  
**After**: Open Add User modal → form has breathing room

### Test 3: Button Sizes
**Before**: Go to mobile (390px) → xs buttons tiny (28px)  
**After**: Go to mobile (390px) → all buttons clickable (44px+)

### Test 4: Loading States
**Before**: Go to /admin/students → "Loading…" text only  
**After**: Go to /admin/students → table skeleton appears

### Test 5: Colors
**Before**: Edit form with error → color inconsistent  
**After**: Edit form with error → red-600 consistent everywhere

---

## IF SOMETHING BREAKS

1. Check browser console for errors (DevTools → Console)
2. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Clear cache: Settings → Delete browsing data → All time
4. Check network tab: Did the API call fail?
5. If CSS issue, check `index.css` for syntax errors
6. Roll back the change and try again

---

## PRIORITY CHECKLIST

```
This Week:
□ Fix hydration flash
□ Fix modal padding
□ Fix ProtectedRoute loading
□ Fix typography hierarchy
□ Add skeleton loaders

Next Week:
□ Fix button/input/select sizing
□ Fix color inconsistencies
□ Dark mode (stretch goal)

Then:
□ Confirmation dialogs
□ Search debounce
□ Offline support
```

---

## SEND TO CLAUDE CODE

**Use this exact prompt**:

```
Read COMPLETE_FRONTEND_AUDIT.md completely.

Apply PHASE A (CSS cleanup) and PHASE B (component fixes) 
as described in that document.

For each step:
1. Make the change
2. Show me the updated code
3. Tell me which file changed
4. Confirm no errors in npm run build

Do not skip any steps. Do not combine fixes.
Apply them in exact order provided in the audit.

Start with ISSUE 1.1 (Hydration Flash).
```

---

## METRIC TO TRACK

**Before** — Measure baseline:
```
⏱️ Time to interactive: ?ms
📊 Lighthouse score: ?
🚀 CPU during load: ?%
💾 JS bundle size: ?kb
```

**After** — Measure improvement:
```
⏱️ Time to interactive: ?ms (target: -500ms)
📊 Lighthouse score: ?   (target: +15 points)
🚀 CPU during load: ?%   (target: -20%)
💾 JS bundle size: ?kb   (target: < 50kb)
```

Run: `npm run build && npm run preview`
Then open DevTools → Lighthouse → Run audit

---

**Print this. Share with your team.**  
**Reference daily while fixing.**

