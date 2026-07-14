# Phase 1 Data Model: Admin Duty Timing Settings

## Entity: `SystemConfig` (table `system_config`) — extended, not new

Single-row table (existing). This feature adds/replaces the auto-checkout and not-checked-in fields; late-threshold and session-start fields are unchanged.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `String` (UUID) | — | unchanged |
| `session_start_morning_hour` | `Int` @db.SmallInt | 8 | unchanged |
| `session_start_morning_min` | `Int` @db.SmallInt | 0 | unchanged |
| `session_start_afternoon_hour` | `Int` @db.SmallInt | 13 | unchanged |
| `session_start_afternoon_min` | `Int` @db.SmallInt | 0 | unchanged |
| `late_threshold_morning_hour` | `Int` @db.SmallInt | 8 | unchanged |
| `late_threshold_morning_min` | `Int` @db.SmallInt | 15 | unchanged |
| `late_threshold_afternoon_hour` | `Int` @db.SmallInt | 13 | unchanged |
| `late_threshold_afternoon_min` | `Int` @db.SmallInt | 15 | unchanged |
| `not_checked_in_morning_hour` | `Int` @db.SmallInt | 8 | **NEW** |
| `not_checked_in_morning_min` | `Int` @db.SmallInt | 30 | **NEW** |
| `not_checked_in_afternoon_hour` | `Int` @db.SmallInt | 13 | **NEW** |
| `not_checked_in_afternoon_min` | `Int` @db.SmallInt | 30 | **NEW** |
| `auto_checkout_morning_hour` | `Int` @db.SmallInt | 16 | **NEW** — replaces shared `auto_checkout_hour` for morning |
| `auto_checkout_morning_min` | `Int` @db.SmallInt | 30 | **NEW** |
| `auto_checkout_afternoon_hour` | `Int` @db.SmallInt | 16 | **NEW** — replaces shared `auto_checkout_hour` for afternoon |
| `auto_checkout_afternoon_min` | `Int` @db.SmallInt | 30 | **NEW** |
| ~~`auto_checkout_hour`~~ | ~~`Int`~~ | — | **REMOVED** — split into per-session pair above |
| ~~`auto_checkout_min`~~ | ~~`Int`~~ | — | **REMOVED** |
| `cover_ttl_hours` | `Int` @db.SmallInt | 48 | unchanged, out of scope for this feature |
| `updated_by` | `String?` (FK → `users.id`) | — | unchanged |
| `updated_at` | `DateTime` @updatedAt | — | unchanged |

### Validation rules (enforced in controller, not schema — see research.md)

For each session ∈ {morning, afternoon}, expressed as minutes-since-midnight:

```
session_start < late_threshold ≤ not_checked_in ≤ auto_checkout
```

- `session_start < late_threshold`: strict — a late cutoff equal to session start would flag every on-time arrival as late.
- `late_threshold ≤ not_checked_in`: non-strict — an Admin may reasonably want them equal.
- `not_checked_in ≤ auto_checkout`: non-strict — same reasoning; also directly answers the spec's Edge Case ("what if not-checked-in cutoff is later than auto clock-out?") — this ordering rule makes that configuration a rejected `422`, not a runtime edge case.

Violation → `422 { error: true, code: 'VALIDATION_ERROR', message: '<session> cutoffs must occur in order after session start.' }`.

### Migration data backfill

Existing single `auto_checkout_hour`/`auto_checkout_min` (16:30 default, or whatever an Admin previously set) is copied into **both** `auto_checkout_morning_*` and `auto_checkout_afternoon_*` on migration, preserving current behavior for existing installs until an Admin explicitly differentiates them (FR-007 — no retroactive behavior change from the migration itself).

## Entity: `DutyAttendance.attendance_status` (derived, not a DB column)

Computed value returned by `GET /attendance/live` (`attendance.controller.js` → `getLive()`). Not persisted — purely a response-shape addition.

| Value | Condition |
|---|---|
| `upcoming` | **NEW** — no attendance row yet, AND current IST time is before that slot's session's `not_checked_in_{session}_hour/min` |
| `not_checked_in` | no attendance row yet, AND current IST time is at/after the not-checked-in cutoff (existing value, now time-gated instead of unconditional) |
| `checked_in` | attendance row exists, `out_time` is null (unchanged) |
| `checked_out` | attendance row exists, `out_time` is set (unchanged) |

No schema/enum change required — `attendance_status` is assembled in the controller response object, not a Prisma enum.
