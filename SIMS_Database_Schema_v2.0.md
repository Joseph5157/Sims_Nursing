# SIMS DMS — Database Schema Reference
**SIMS College of Pharmacy — Discipline Management System**
Version 2.0 | PostgreSQL | Prisma ORM

> **Changes from v1.0:**
> - `users.role` ENUM: removed `coordinator` — 3 roles only (super_admin / admin / faculty)
> - `reschedule_requests` → `cover_requests` — rewritten for Need Cover broadcast model
> - `correction_requests` table removed — replaced by `violations.is_flagged` + `violations.flag_note`
> - `violation_audit_log.change_type` ENUM: `correction_applied` → `flag_resolved`
> - `violations.photo_path` and `violations.photo_expires_at` kept as **foundation placeholder** — not implemented in Phase 1
> - `photo_access_log` kept as **foundation placeholder** — not implemented in Phase 1
> - `otp_sessions.phone` → `user_id UUID → users` — FK to users table (cleaner, enforces account must exist before OTP can be issued)
> - `admin_audit_log` added — system-level immutable audit trail (session resets, account changes, hard deletes, settings updates). Separate from `violation_audit_log` which is scoped to violation records only.
> - **Total: 14 tables** (was 13)

---

## 14 Tables at a Glance

| # | Table Name | Purpose |
|---|-----------|---------|
| 1 | `users` | All system users — faculty, admin, super admin (3 roles) |
| 2 | `otp_sessions` | Telegram OTP flow + brute force protection |
| 3 | `students` | Student master data uploaded via Excel |
| 4 | `duty_slots` | Monthly duty assignments per faculty |
| 5 | `duty_attendance` | Faculty IN/OUT timestamps and status |
| 6 | `violation_types` | Predefined violation categories (with system lock) |
| 7 | `violations` | All recorded student violations — includes flag fields |
| 8 | `violation_audit_log` | Immutable change history for every violation record |
| 9 | `admin_audit_log` | Immutable system-level audit trail (session resets, account changes, hard deletes) |
| 10 | `cover_requests` | Need Cover broadcasts — open to all faculty, confirmed by Admin |
| 11 | `calendar_config` | Monthly scheduling window, blocked dates, working days |
| 12 | `messages` | Two-way internal messaging between users |
| 13 | `photo_access_log` | ⚠ Foundation placeholder — not implemented in Phase 1 |
| 14 | `student_upload_log` | History of Excel uploads including error rows |

> **Removed**: `correction_requests` (replaced by `violations.is_flagged`)

---

## 1. Core User & Auth Tables

### Table: `users`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| name | VARCHAR(150) | Full name |
| email | VARCHAR(200) UNIQUE | Contact email (not used for login) |
| phone | VARCHAR(20) | Contact number |
| role | ENUM | `super_admin` / `admin` / `faculty` |
| department | VARCHAR(100) | Academic department |
| designation | VARCHAR(100) | Job title |
| telegram_id | VARCHAR(50) | Telegram user ID for OTP delivery |
| telegram_verified | BOOLEAN | Whether Telegram ID is confirmed |
| status | ENUM | `pending` / `active` / `inactive` |
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
| attempt_count | SMALLINT | Failed attempts — lock after 5 |
| created_at | TIMESTAMPTZ | Auto-set on insert |

---

## 2. Student Tables

### Table: `students`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| registration_number | VARCHAR(50) UNIQUE | Upsert key on Excel upload |
| student_name | VARCHAR(150) | Full name |
| course | VARCHAR(50) | B.Pharm / Pharm.D |
| semester_or_year | VARCHAR(20) | Current semester or year |
| academic_year | VARCHAR(10) | e.g. 2024-25 |
| institution | VARCHAR(150) | Campus / institution name |
| status | ENUM | `active` / `inactive` |
| deleted_at | TIMESTAMPTZ | Soft delete (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

### Table: `student_upload_log`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| uploaded_by | UUID → users | Admin who uploaded |
| filename | VARCHAR(255) | Original Excel filename |
| added_count | INTEGER | New students created |
| updated_count | INTEGER | Existing students updated |
| deactivated_count | INTEGER | Students deactivated |
| errors | JSONB | Array of failed rows with reason |
| uploaded_at | TIMESTAMPTZ | Upload timestamp |

---

## 3. Duty Tables

### Table: `duty_slots`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| faculty_id | UUID → users | Assigned faculty member |
| duty_date | DATE | Date of duty |
| session_type | ENUM | `morning` / `afternoon` |
| status | ENUM | `scheduled` / `completed` / `absent` / `cover_pending` / `covered` |
| covered_by | UUID → users | Faculty who covered this slot (nullable) |
| created_by | UUID → users | Who created this slot |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

> Note: `rescheduled_from` and `rescheduled` status removed — replaced by `cover_requests` flow.

---

### Table: `duty_attendance`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| duty_slot_id | UUID → duty_slots | The duty this record belongs to |
| faculty_id | UUID → users | Faculty on duty |
| in_time | TIMESTAMPTZ | Clock-in timestamp (nullable until checked in) |
| out_time | TIMESTAMPTZ | Clock-out timestamp (nullable until checked out) |
| in_status | ENUM | `normal` / `late` / `absent` |
| out_status | ENUM | `normal` / `auto` |
| auto_out | BOOLEAN | True if system auto-clocked out at 4:30 PM |
| overridden_by | UUID → users | Who overrode the record (nullable) |
| override_reason | TEXT | Reason for override (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

### Table: `cover_requests`

> Replaces `reschedule_requests`. Open broadcast model — any faculty can volunteer, Admin confirms.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| duty_slot_id | UUID → duty_slots | The slot needing cover |
| requested_by | UUID → users | Faculty posting the broadcast |
| reason | TEXT | Why cover is needed |
| status | ENUM | `open` / `covered` / `expired` / `cancelled` |
| volunteer_id | UUID → users | Faculty who volunteered (nullable until someone volunteers) |
| confirmed_by | UUID → users | Admin who confirmed the cover (nullable) |
| confirmed_at | TIMESTAMPTZ | When Admin confirmed (nullable) |
| expires_at | TIMESTAMPTZ | Auto-expire after 48 hours |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

### Table: `calendar_config`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| config_month | SMALLINT | Month (1–12) |
| config_year | SMALLINT | Year (e.g. 2025) |
| blocked_dates | JSONB | Array of ISO date strings that are blocked (holidays) |
| working_days | JSONB | Array of ISO date strings set as working days for the month |
| sessions_per_faculty | SMALLINT | How many sessions each faculty must pick (default: 3) |
| max_cover_requests_per_slot | SMALLINT | Admin-configurable max cover requests per slot |
| is_window_open | BOOLEAN | Whether faculty can currently pick slots |
| opened_by | UUID → users | Admin who opened the window (nullable) |
| opened_at | TIMESTAMPTZ | When window was opened (nullable) |
| closes_at | TIMESTAMPTZ | When window auto-closes — last day of month (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

## 4. Violation Tables

### Table: `violation_types`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| name | VARCHAR(150) | Violation name (e.g. Mobile Usage, Dress Code) |
| default_fine | DECIMAL(8,2) | Default fine in ₹ |
| is_active | BOOLEAN | Whether this type is available for selection |
| is_system | BOOLEAN | Prevents deleting built-in types like 'Others' |
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
| custom_violation | TEXT | Custom description if type is 'Others' (nullable) |
| fine_amount | DECIMAL(8,2) | Final fine in ₹ (may differ from default) |
| is_warning_only | BOOLEAN | True = warning issued, no fine |
| remarks | TEXT | Additional notes (nullable) |
| is_flagged | BOOLEAN | Faculty flagged this record for Admin review |
| flag_note | TEXT | Faculty's reason for flagging (nullable) |
| flag_resolved_by | UUID → users | Admin who resolved the flag (nullable) |
| flag_resolved_at | TIMESTAMPTZ | When flag was resolved (nullable) |
| record_status | ENUM | `active` / `hidden` |
| photo_path | VARCHAR(500) | ⚠ Foundation placeholder — not used in Phase 1 (nullable) |
| photo_expires_at | TIMESTAMPTZ | ⚠ Foundation placeholder — not used in Phase 1 (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |
| updated_at | TIMESTAMPTZ | Auto-updated on change |

---

### Table: `violation_audit_log`

> Immutable — no `updated_at`. Never update or delete rows from this table.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| violation_id | UUID → violations | Which violation was changed |
| changed_by | UUID → users | Who made the change |
| change_type | ENUM | `created` / `edited` / `hidden` / `flagged` / `flag_resolved` |
| old_data | JSONB | Snapshot before the change |
| new_data | JSONB | Snapshot after the change |
| reason | TEXT | Reason for change (nullable) |
| created_at | TIMESTAMPTZ | Auto-set on insert |

---

---

### Table: `admin_audit_log`

> Immutable — no `updated_at`. Records all system-level admin actions. Never update or delete rows from this table.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| actor_id | UUID → users | Who performed the action |
| action | VARCHAR(50) | Action type: `session_reset` / `account_approved` / `account_deactivated` / `hard_delete` / `settings_updated` |
| target_id | UUID | ID of the affected resource (nullable for settings actions) |
| target_type | VARCHAR(50) | Resource type: `users` / `violations` / `duty_slots` / etc. |
| metadata | JSONB | Additional context — e.g. old/new values, reason |
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

---

### Table: `photo_access_log`

> ⚠ **Foundation placeholder** — table exists in schema but no endpoints or logic write to it in Phase 1.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Unique identifier |
| violation_id | UUID → violations | Which violation's photo was accessed |
| accessed_by | UUID → users | Who viewed the photo |
| accessed_at | TIMESTAMPTZ | When it was accessed |

---

## 6. Key Design Rules

### Global Conventions

- All primary keys use **UUID** — never sequential integers
- All tables include `created_at` and `updated_at` (auto-managed via Prisma)
- **Soft deletes** use `deleted_at` — data is never permanently removed except via Super Admin hard-delete endpoint
- All monetary values use **DECIMAL(8,2)** — never floats
- **JSONB** used for flexible data: blocked dates, working days, audit snapshots, upload errors
- `violation_audit_log` is **immutable** — never update or delete rows

### Indexes

| Index | Table | Purpose |
|-------|-------|---------|
| `violations(student_id)` | violations | Fast student violation lookup |
| `violations(faculty_id)` | violations | Fast faculty report generation |
| `violations(duty_slot_id)` | violations | Session-level violation queries |
| `violations(is_flagged)` | violations | Fast flag queue for Admin |
| `duty_slots(faculty_id, duty_date)` | duty_slots | Calendar view per faculty |
| `duty_attendance(duty_slot_id)` | duty_attendance | IN/OUT lookup per session |
| `otp_sessions(user_id, expires_at)` | otp_sessions | Fast OTP verification |
| `cover_requests(status, expires_at)` | cover_requests | Expiry cron + open broadcast list |
| `violations(photo_expires_at) WHERE photo_expires_at IS NOT NULL` | violations | Foundation — photo cleanup cron (Phase 2) |

---

## 7. Cron Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Auto clock-out | Daily 4:30 PM | Set `out_time = 4:30 PM`, `auto_out = true` for unchecked-out faculty |
| Cover request expiry | Every hour | Set `status = expired` where `expires_at < NOW()` and `status = open` |
| Calendar auto-close | Daily midnight | Set `is_window_open = false` on last day of month |
| Photo expiry | Daily midnight | ⚠ Foundation — not active in Phase 1 |

---

*Schema version: 2.0 — Updated: June 2026*
*Supersedes SIMS_Database_Schema_v1.0.docx*
