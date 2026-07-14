# SIMS DMS — Database Schema Reference
**SIMS College of Pharmacy — Discipline Management System**
Version 2.1 | PostgreSQL | Prisma ORM

> **Changes from v2.0:**
> - `system_config` table added — single-row system-wide timing and threshold settings (15th model)
> - `users` table: added `otp_failed_attempts`, `session_version`, `telegram_invite_token`, `telegram_invite_expires_at` columns
> - `UserStatus` ENUM: added `pending_telegram` state — user registered but not yet linked to Telegram Bot
> - **Total: 15 tables** (was 14)

---

## 15 Tables at a Glance

| # | Table Name | Purpose |
|---|-----------|---------|
| 1 | `users` | All system users — faculty, admin, super admin (3 roles) |
| 2 | `otp_sessions` | Telegram OTP flow + brute force protection |
| 3 | `students` | Student master data uploaded via Excel |
| 4 | `student_upload_log` | History of Excel uploads including error rows |
| 5 | `duty_slots` | Monthly duty assignments per faculty |
| 6 | `duty_attendance` | Faculty IN/OUT timestamps and status |
| 7 | `violation_types` | Predefined violation categories (with system lock) |
| 8 | `violations` | All recorded student violations — includes flag fields |
| 9 | `violation_audit_log` | Immutable change history for every violation record |
| 10 | `admin_audit_log` | Immutable system-level audit trail (session resets, account changes, hard deletes) |
| 11 | `cover_requests` | Need Cover broadcasts — open to all faculty, confirmed by Admin |
| 12 | `calendar_config` | Monthly scheduling window, blocked dates, working days |
| 13 | `messages` | Two-way internal messaging between users |
| 14 | `system_config` | Single-row system-wide timing thresholds and operational settings |
| 15 | `photo_access_log` | ⚠ Foundation placeholder — not implemented in Phase 1 |

> **Removed**: `correction_requests` (replaced by `violations.is_flagged`), `reschedule_requests` (replaced by `cover_requests`)

---

## Enums Reference

| Enum | Values |
|------|--------|
| `Role` | `super_admin` / `admin` / `faculty` |
| `UserStatus` | `pending_telegram` / `pending` / `active` / `inactive` |
| `SessionType` | `morning` / `afternoon` |
| `SlotStatus` | `scheduled` / `completed` / `absent` / `cover_pending` / `covered` |
| `AttendanceInStatus` | `normal` / `late` / `absent` |
| `AttendanceOutStatus` | `normal` / `auto` |
| `CoverStatus` | `open` / `covered` / `expired` / `cancelled` |
| `RecordStatus` | `active` / `hidden` |
| `ViolationChangeType` | `created` / `edited` / `hidden` / `flagged` / `flag_resolved` |

**`UserStatus` state meanings:**
- `pending_telegram` — account created by Admin, invite token issued, user has not yet linked their Telegram account
- `pending` — Telegram linked, awaiting Admin approval
- `active` — approved and able to log in
- `inactive` — deactivated by Admin; cannot authenticate

---

## 1. Core User & Auth Tables

### Table: `users`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| name | VARCHAR(150) | Full name |
| email | VARCHAR(200) UNIQUE | Contact email (not used for login) |
| phone | VARCHAR(20) | Contact number (nullable) |
| role | ENUM `Role` | `super_admin` / `admin` / `faculty` |
| department | VARCHAR(100) | Academic department (nullable) |
| designation | VARCHAR(100) | Job title (nullable) |
| telegram_id | VARCHAR(50) UNIQUE | Telegram numeric chat ID — set by bot on invite link activation (nullable) |
| telegram_verified | BOOLEAN | Whether Telegram ID is confirmed via invite flow |
| telegram_invite_token | VARCHAR(100) UNIQUE | One-time token sent in the Telegram invite link (nullable) |
| telegram_invite_expires_at | TIMESTAMPTZ | Expiry for the invite token (nullable) |
| otp_failed_attempts | SMALLINT | Consecutive failed OTP entries — account locks after 5 |
| session_version | INTEGER | Incremented on session reset — invalidates all existing JWTs for this user |
| status | ENUM `UserStatus` | `pending_telegram` / `pending` / `active` / `inactive` |
| approved_at | TIMESTAMPTZ | When account was approved (nullable) |
| approved_by | UUID → users | Who approved this account (nullable) |
| deleted_at | TIMESTAMPTZ | Soft delete timestamp (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

### Table: `otp_sessions`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique session identifier |
| user_id | UUID → users | The user requesting the OTP — must exist and be active |
| otp_hash | VARCHAR(255) | Bcrypt hash of the OTP — never stored plain |
| expires_at | TIMESTAMPTZ | OTP expiry (5 min from creation) |
| verified | BOOLEAN | Whether this OTP was successfully used |
| attempt_count | SMALLINT | Failed attempts on this session |
| created_at | TIMESTAMPTZ | Auto-set on insert |

**Indexes:**

| Index | Purpose |
|-------|---------|
| `(user_id, expires_at)` | Fast OTP verification lookup |

---

## 2. Student Tables

### Table: `students`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| registration_number | VARCHAR(50) UNIQUE | Upsert key on Excel upload |
| student_name | VARCHAR(150) | Full name |
| course | VARCHAR(50) | e.g. B.Pharm / Pharm.D |
| semester_or_year | VARCHAR(20) | Current semester or year |
| academic_year | VARCHAR(10) | e.g. 2024-25 |
| institution | VARCHAR(150) | Campus / institution name |
| status | VARCHAR(10) | `active` / `inactive` — set to inactive on deactivation or missing from upload |
| deleted_at | TIMESTAMPTZ | Soft delete (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

### Table: `student_upload_log`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| uploaded_by | UUID → users | Admin who performed the upload |
| filename | VARCHAR(255) | Original Excel filename |
| added_count | INTEGER | New student rows created |
| updated_count | INTEGER | Existing student rows updated |
| deactivated_count | INTEGER | Students deactivated (present in DB, absent from file) |
| errors | JSONB | Array of failed rows — each entry contains row data and failure reason |
| uploaded_at | TIMESTAMPTZ | Upload timestamp (auto-set on insert) |

---

## 3. Duty Tables

### Table: `duty_slots`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| faculty_id | UUID → users | Assigned faculty member |
| duty_date | DATE | Date of duty |
| session_type | ENUM `SessionType` | `morning` / `afternoon` |
| status | ENUM `SlotStatus` | `scheduled` / `completed` / `absent` / `cover_pending` / `covered` |
| covered_by | UUID → users | Faculty who covered this slot (nullable) |
| created_by | UUID → users | Who created this slot (faculty via self-pick or admin via assign) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

**Unique constraint:** `(duty_date, session_type)` — only one duty slot exists per date-session combination system-wide.

**Indexes:**

| Index | Purpose |
|-------|---------|
| `UNIQUE (duty_date, session_type)` | DB-level backstop preventing double-booking races |
| `(faculty_id, duty_date)` | Calendar view per faculty |

---

### Table: `duty_attendance`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| duty_slot_id | UUID → duty_slots UNIQUE | The duty this record belongs to — one attendance row per slot |
| faculty_id | UUID → users | Faculty on duty |
| in_time | TIMESTAMPTZ | Clock-in timestamp (nullable until checked in) |
| out_time | TIMESTAMPTZ | Clock-out timestamp (nullable until checked out) |
| in_status | ENUM `AttendanceInStatus` | `normal` / `late` / `absent` |
| out_status | ENUM `AttendanceOutStatus` | `normal` / `auto` |
| auto_out | BOOLEAN | True if system auto-clocked out at configured time (cron) |
| overridden_by | UUID → users | Who overrode the record (nullable) |
| override_reason | TEXT | Reason for override (nullable — required when overridden) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

**Indexes:**

| Index | Purpose |
|-------|---------|
| `(duty_slot_id)` | IN/OUT lookup per session |

---

### Table: `cover_requests`

> Replaces `reschedule_requests`. Open broadcast model — any faculty can volunteer, Admin confirms.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| duty_slot_id | UUID → duty_slots | The slot needing cover |
| requested_by | UUID → users | Faculty posting the broadcast |
| reason | TEXT | Why cover is needed (nullable) |
| status | ENUM `CoverStatus` | `open` / `covered` / `expired` / `cancelled` |
| volunteer_id | UUID → users | Faculty who volunteered (nullable until someone volunteers) |
| confirmed_by | UUID → users | Admin who confirmed the cover (nullable) |
| confirmed_at | TIMESTAMPTZ | When Admin confirmed (nullable) |
| expires_at | TIMESTAMPTZ | Auto-expire after 48 hours — checked by cron |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

**Indexes:**

| Index | Purpose |
|-------|---------|
| `(status, expires_at)` | Expiry cron + open broadcast list |

---

### Table: `calendar_config`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| config_month | SMALLINT | Month (1–12) |
| config_year | SMALLINT | Year (e.g. 2025) |
| blocked_dates | JSONB | Array of ISO date strings blocked as holidays |
| working_days | JSONB | Array of ISO date strings set as working days for the month |
| sessions_per_faculty | SMALLINT | How many sessions each faculty must pick (default: 3) |
| max_cover_requests_per_slot | SMALLINT | Admin-configurable max cover requests per slot (default: 3) |
| is_window_open | BOOLEAN | Whether faculty can currently pick slots |
| opened_by | UUID → users | Admin who opened the window (nullable) |
| opened_at | TIMESTAMPTZ | When window was opened (nullable) |
| closes_at | TIMESTAMPTZ | When window auto-closes — last day of month at 23:55 IST (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

**Unique constraint:** `(config_month, config_year)` — one config row per month.

---

## 4. Violation Tables

### Table: `violation_types`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| name | VARCHAR(150) | Violation name (e.g. Mobile Usage, Dress Code) |
| default_fine | DECIMAL(8,2) | Default fine amount in ₹ |
| is_active | BOOLEAN | Whether this type is available for selection |
| is_system | BOOLEAN | Prevents deletion of built-in types (e.g. 'Others') |
| created_by | UUID → users | Admin who created this type |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

### Table: `violations`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| student_id | UUID → students | Student who committed the violation |
| faculty_id | UUID → users | Faculty who recorded it |
| duty_slot_id | UUID → duty_slots | Duty session it occurred in |
| violation_type_id | UUID → violation_types | Type selected |
| custom_violation | TEXT | Custom description — required when type is 'Others' (nullable) |
| fine_amount | DECIMAL(8,2) | Final fine in ₹ — may differ from default |
| is_warning_only | BOOLEAN | True = warning issued, no fine applied |
| remarks | TEXT | Additional notes (nullable) |
| is_flagged | BOOLEAN | Faculty flagged this record for Admin review |
| flag_note | TEXT | Faculty's reason for flagging (nullable) |
| flag_resolved_by | UUID → users | Admin who resolved the flag (nullable) |
| flag_resolved_at | TIMESTAMPTZ | When flag was resolved (nullable) |
| record_status | ENUM `RecordStatus` | `active` / `hidden` |
| photo_path | VARCHAR(500) | ⚠ Foundation placeholder — not used in Phase 1 (nullable) |
| photo_expires_at | TIMESTAMPTZ | ⚠ Foundation placeholder — not used in Phase 1 (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

**Indexes:**

| Index | Purpose |
|-------|---------|
| `(student_id)` | Fast student violation lookup |
| `(faculty_id)` | Fast faculty report generation |
| `(duty_slot_id)` | Session-level violation queries |
| `(is_flagged)` | Fast flag queue for Admin |

---

### Table: `violation_audit_log`

> Immutable — no `updated_at`. Never update or delete rows from this table.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| violation_id | UUID → violations | Which violation was changed |
| changed_by | UUID → users | Who made the change |
| change_type | ENUM `ViolationChangeType` | `created` / `edited` / `hidden` / `flagged` / `flag_resolved` |
| old_data | JSONB | Snapshot of fields before the change (nullable) |
| new_data | JSONB | Snapshot of fields after the change (nullable) |
| reason | TEXT | Reason for change — required for edits and hides (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |

---

### Table: `admin_audit_log`

> Immutable — no `updated_at`. Records all system-level admin actions. Never update or delete rows from this table.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| actor_id | UUID → users | Who performed the action |
| action | VARCHAR(50) | Action type: `session_reset` / `account_approved` / `account_deactivated` / `hard_delete` / `settings_updated` |
| target_id | UUID | ID of the affected resource (nullable for settings actions) |
| target_type | VARCHAR(50) | Resource type: `users` / `violations` / `duty_slots` / etc. (nullable) |
| metadata | JSONB | Additional context — e.g. old/new values, reason (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |

---

## 5. Messaging & Access Tables

### Table: `messages`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| from_user_id | UUID → users | Sender |
| to_user_id | UUID → users | Recipient |
| subject | VARCHAR(255) | Message subject |
| body | TEXT | Message content |
| is_read | BOOLEAN | Whether recipient has read it |
| read_at | TIMESTAMPTZ | When it was read (nullable) |
| deleted_by_sender | BOOLEAN | Sender soft-deleted from their view |
| deleted_by_receiver | BOOLEAN | Receiver soft-deleted from their view |
| created_at | TIMESTAMPTZ | Auto-set on insert |

**Indexes:**

| Index | Purpose |
|-------|---------|
| `(to_user_id, created_at)` | Inbox listing — newest first |
| `(from_user_id, created_at)` | Sent-items listing |
| `(to_user_id, is_read)` | Unread count query |

---

### Table: `photo_access_log`

> ⚠ **Foundation placeholder** — table exists in schema but no endpoints or logic write to it in Phase 1.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| violation_id | UUID → violations | Which violation's photo was accessed |
| accessed_by | UUID → users | Who viewed the photo |
| accessed_at | TIMESTAMPTZ | When it was accessed (auto-set on insert) |

---

## 6. System Configuration

### Table: `system_config`

> Single-row table — always access via `settings.service.js`, never query directly. Contains system-wide operational thresholds configurable by Admin/Super Admin.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Single-row identifier |
| late_threshold_morning_hour | SMALLINT | IST hour after which a morning check-in is flagged late (default: 8) |
| late_threshold_morning_min | SMALLINT | IST minute after which a morning check-in is flagged late (default: 15) |
| late_threshold_afternoon_hour | SMALLINT | IST hour after which an afternoon check-in is flagged late (default: 13) |
| late_threshold_afternoon_min | SMALLINT | IST minute after which an afternoon check-in is flagged late (default: 15) |
| auto_checkout_hour | SMALLINT | IST hour for the daily auto clock-out cron (default: 16) |
| auto_checkout_min | SMALLINT | IST minute for the daily auto clock-out cron (default: 30) |
| cover_ttl_hours | SMALLINT | Hours before an open cover request auto-expires (default: 48) |
| session_start_morning_hour | SMALLINT | IST hour when the morning duty session starts — window opens 30 min before (default: 8) |
| session_start_morning_min | SMALLINT | IST minute component of morning session start (default: 0) |
| session_start_afternoon_hour | SMALLINT | IST hour when the afternoon duty session starts — window opens 30 min before (default: 13) |
| session_start_afternoon_min | SMALLINT | IST minute component of afternoon session start (default: 0) |
| updated_by | UUID → users | Last Admin/Super Admin who updated settings (nullable) |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

## 7. Key Design Rules

### Global Conventions

- All primary keys use **UUID** — never sequential integers
- All tables include `created_at` (most also `updated_at`, except immutable audit logs and `photo_access_log`)
- **Soft deletes** use `deleted_at` — data is never permanently removed except via Super Admin hard-delete endpoint
- All monetary values use **DECIMAL(8,2)** — never floats
- **JSONB** used for flexible data: blocked dates, working days, audit snapshots, upload errors
- `violation_audit_log` and `admin_audit_log` are **immutable** — never update or delete rows
- `system_config` is a **single-row table** — always accessed via `settings.service.js`

### Full Index List

| Index | Table | Type | Purpose |
|-------|-------|------|---------|
| `(user_id, expires_at)` | `otp_sessions` | Composite | Fast OTP verification lookup |
| `UNIQUE (duty_date, session_type)` | `duty_slots` | Unique | Prevents double-booking at DB level |
| `(faculty_id, duty_date)` | `duty_slots` | Composite | Calendar view per faculty |
| `(duty_slot_id)` | `duty_attendance` | Single | IN/OUT lookup per session |
| `(student_id)` | `violations` | Single | Fast student violation lookup |
| `(faculty_id)` | `violations` | Single | Fast faculty report generation |
| `(duty_slot_id)` | `violations` | Single | Session-level violation queries |
| `(is_flagged)` | `violations` | Single | Fast flag queue for Admin |
| `(violation_type_id)` | `violations` | Single | Violation-type breakdown report |
| `(status, expires_at)` | `cover_requests` | Composite | Expiry cron + open broadcast list |
| `UNIQUE (config_month, config_year)` | `calendar_config` | Unique | One config row per month |
| `(to_user_id, created_at)` | `messages` | Composite | Inbox listing — newest first |
| `(from_user_id, created_at)` | `messages` | Composite | Sent-items listing with sort |
| `(from_user_id)` | `messages` | Single | FK lookup — unsorted sent-by queries |
| `(to_user_id, is_read)` | `messages` | Composite | Unread count query |

---

## 8. Cron Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Auto clock-out | Daily 16:30 IST | Set `out_time`, `out_status = auto`, `auto_out = true` for unchecked-out faculty |
| Cover request expiry | Every hour | Set `status = expired` where `expires_at < NOW()` and `status = open` |
| Calendar auto-close | Daily 23:55 IST | Set `is_window_open = false` on the last day of the month |
| OTP session cleanup | Daily 03:00 IST | Delete `otp_sessions` rows with `expires_at` older than 7 days |
| Photo expiry | Daily midnight | ⚠ Foundation — not active in Phase 1 |

---

*Schema version: 2.1 — Updated: June 2026*
*Supersedes SIMS_Database_Schema_v2.0.md*
*Source of truth: `prisma/schema.prisma`*
