# SIMS DMS — Project Constitution
<!-- Synced from CONSTITUTION.md — Single source of truth is CONSTITUTION.md at project root -->

## Core Principles

### I. Tech Stack is Locked
**Frontend**: React.js, Vite, TanStack Query, Tailwind CSS, Workbox (PWA).
**Backend**: Node.js + Express, Prisma ORM, Zod validation, Helmet.js, express-rate-limit, Morgan + Winston.
**Infra**: PostgreSQL + Railway, REST API, monolithic, 30-second polling (no WebSockets). Do not suggest alternatives.

### II. Auth is Telegram OTP Only
No passwords, no email OTP, no SMS. JWT in httpOnly cookie only — never localStorage. OTP expires in 5 minutes, max 5 attempts before lockout.

### III. Data Safety (NON-NEGOTIABLE)
All deletes are soft deletes (`deleted_at`) — Super Admin hard-delete is the only exception. UUID primary keys only. DECIMAL(8,2) for all monetary values. Every table has `created_at` and `updated_at`.

### IV. Roles are Fixed
Exactly 4 roles: Super Admin, Admin, Coordinator, Faculty. Do not add, merge, or rename roles.

### V. Phased Development
Phase 1 (MVP, Weeks 1–4) must be complete and bug-free before starting Phase 2. Do not work across phases simultaneously.

## Additional Constraints

- No raw SQL except complex reports — all DB access via Prisma
- No `console.log` in production — use Winston logger
- No sequential integer IDs — UUID only
- No floats for money — DECIMAL(8,2) only
- Never expose JWT secret, Telegram bot token, or DATABASE_URL in code or comments
- Never bypass Zod validation on any API input

## Database

14 tables: `users`, `otp_sessions`, `students`, `duty_slots`, `duty_attendance`, `violation_types`, `violations`, `violation_audit_log`, `correction_requests`, `reschedule_requests`, `calendar_config`, `messages`, `photo_access_log`, `student_upload_log`

## API

55 endpoints across 11 modules. All errors: `{ "error": true, "code": "ERROR_CODE", "message": "..." }`

## Governance

CONSTITUTION.md supersedes all other documents. Read it before any action on the codebase. Do not modify without project owner approval.

**Version**: 2.0 | **Ratified**: June 2026 | **Last Amended**: June 2026
