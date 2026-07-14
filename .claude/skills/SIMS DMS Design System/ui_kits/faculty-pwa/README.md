# Faculty PWA — UI kit

A high-fidelity, click-through recreation of the **Faculty** surface of SIMS DMS — the
mobile-first PWA faculty members use on their phones (390px). Composes the design
system's components (`Button`, `Badge`, `StatCard`, `Alert`, `Input`, `MobileCard`,
`SectionHeader`, `EmptyState`, `BrandMark`) inside an iOS-style phone frame.

## Flow
1. **Login** — email → Telegram OTP (6-box code) → dashboard.
2. **Dashboard** — "duty today" CTA, cover-request alert, 3-up stats, upcoming duties, recent messages.
3. **My Slots** — picked/required progress, this month's slots, request-cover prompt.
4. **Attendance** — check-in → check-out state machine with on-time/late framing.
5. **Violations** — two-step recorder: pick a student, tap a violation type chip, log it.
6. **Messages** — inbox list + compose.

Navigate via the dark bottom tab bar (matches the product's mobile nav). Start the demo
by signing in (any email; OTP accepts any 6 digits).

## Files
- `index.html` — mounts the app + router state. Loads `../../_ds_bundle.js`.
- `shell.jsx` — `PhoneFrame`, `StatusBar`, `BottomTabBar`, `PageBody`, `MobilePageHeader`, mock data.
- `screens.jsx` — the six screens.

## Fidelity notes
Recreates the real screens (`LoginPage`, `faculty/DashboardPage`, `AttendancePage`,
`ViolationRecorderPage`, `SlotPickerPage`, `MessagesPage`) cosmetically — data is mocked,
no network/auth. The Admin and Super-Admin surfaces (desktop sidebar layout) are **not**
included in this kit.
