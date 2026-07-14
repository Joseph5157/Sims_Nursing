# SIMS Discipline Management System (SIMS DMS) — Project Overview

The SIMS Discipline Management System (SIMS DMS) is a web-based mobile-first PWA application built for the **SIMS College of Pharmacy** (managing ~20–30 faculty members) to replace a manual, paper-based system. It digitizes scheduling discipline duties, monitoring attendance (In/Out checks), and logging/auditing student violations on campus.

This overview provides a thorough analysis of the repository from three key perspectives: **Software Architect**, **Software Developer**, and **Product Manager**.

---

## System Diagrams

### 1. High-Level System Architecture
```mermaid
graph TD
    Client["React PWA Client (Vite + Tailwind v4)"]
    Server["Express.js API Server (Node.js)"]
    Database[("PostgreSQL Database (Prisma)")]
    Telegram["Telegram Bot API"]

    Client -- "HTTPS / httpOnly Cookies (JWT)" --> Server
    Server -- "Prisma ORM" --> Database
    Server -- "Outgoing HTTPS (OTP & Notifications)" --> Telegram
    Telegram -.-> UserTelegram["Faculty Telegram App"]
    UserTelegram -.-> Client
```

---

### 2. Database Schema (Prisma ERD)
```mermaid
erDiagram
    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar phone
        enum role
        varchar department
        varchar designation
        varchar telegram_id UK
        boolean telegram_verified
        smallint otp_failed_attempts
        enum status
        timestamp approved_at
        uuid approved_by FK
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }
    otp_sessions {
        uuid id PK
        uuid user_id FK
        varchar otp_hash
        timestamp expires_at
        boolean verified
        smallint attempt_count
        timestamp created_at
    }
    students {
        uuid id PK
        varchar registration_number UK
        varchar student_name
        varchar course
        varchar semester_or_year
        varchar academic_year
        varchar institution
        varchar status
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }
    duty_slots {
        uuid id PK
        uuid faculty_id FK
        date duty_date
        enum session_type
        enum status
        uuid covered_by FK
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }
    duty_attendance {
        uuid id PK
        uuid duty_slot_id FK
        uuid faculty_id FK
        timestamp in_time
        timestamp out_time
        enum in_status
        enum out_status
        boolean auto_out
        uuid overridden_by FK
        text override_reason
        timestamp created_at
        timestamp updated_at
    }
    violation_types {
        uuid id PK
        varchar name
        decimal default_fine
        boolean is_active
        boolean is_system
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }
    violations {
        uuid id PK
        uuid student_id FK
        uuid faculty_id FK
        uuid duty_slot_id FK
        uuid violation_type_id FK
        text custom_violation
        decimal fine_amount
        boolean is_warning_only
        text remarks
        boolean is_flagged
        text flag_note
        uuid flag_resolved_by FK
        timestamp flag_resolved_at
        enum record_status
        varchar photo_path
        timestamp photo_expires_at
        timestamp created_at
        timestamp updated_at
    }
    violation_audit_log {
        uuid id PK
        uuid violation_id FK
        uuid changed_by FK
        enum change_type
        json old_data
        json new_data
        text reason
        timestamp created_at
    }
    admin_audit_log {
        uuid id PK
        uuid actor_id FK
        varchar action
        uuid target_id
        varchar target_type
        json metadata
        timestamp created_at
    }
    cover_requests {
        uuid id PK
        uuid duty_slot_id FK
        uuid requested_by FK
        text reason
        enum status
        uuid volunteer_id FK
        uuid confirmed_by FK
        timestamp confirmed_at
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }
    calendar_config {
        uuid id PK
        smallint config_month
        smallint config_year
        json blocked_dates
        json working_days
        smallint sessions_per_faculty
        smallint max_cover_requests_per_slot
        boolean is_window_open
        uuid opened_by FK
        timestamp opened_at
        timestamp closes_at
        timestamp created_at
        timestamp updated_at
    }
    messages {
        uuid id PK
        uuid from_user_id FK
        uuid to_user_id FK
        varchar subject
        text body
        boolean is_read
        timestamp read_at
        boolean deleted_by_sender
        boolean deleted_by_receiver
        timestamp created_at
    }
    system_config {
        uuid id PK
        smallint late_threshold_morning_hour
        smallint late_threshold_morning_min
        smallint late_threshold_afternoon_hour
        smallint late_threshold_afternoon_min
        smallint auto_checkout_hour
        smallint auto_checkout_min
        smallint cover_ttl_hours
        uuid updated_by FK
        timestamp updated_at
    }

    users ||--o{ otp_sessions : triggers
    users ||--o{ duty_slots : assigned
    users ||--o{ duty_attendance : logs
    users ||--o{ violations : records
    users ||--o{ cover_requests : requests
    students ||--o{ violations : commits
    duty_slots ||--o{ violations : occurrences
    duty_slots ||--|| duty_attendance : tracks
    violation_types ||--o{ violations : defines
    violations ||--o{ violation_audit_log : audits
    duty_slots ||--o{ cover_requests : broadcasts
    users ||--o{ messages : communications
    users ||--o{ admin_audit_log : performs
```

---

### 3. Sequence: Telegram OTP Authentication
```mermaid
sequenceDiagram
    actor Faculty as Faculty Member
    participant PWA as React PWA Client
    participant Server as Express Server
    participant DB as PostgreSQL (Prisma)
    participant TG as Telegram API

    Faculty->>PWA: Enter Telegram ID & click Request OTP
    PWA->>Server: POST /auth/request-otp { telegram_id }
    Server->>DB: Query active user by telegram_id
    alt User is invalid, inactive, or locked
        Server-->>PWA: Return Error Response (404/403/429)
        PWA-->>Faculty: Display warning message
    else User is valid & active
        Server->>Server: Generate cryptographically random 6-digit OTP
        Server->>DB: Create OtpSession (hash, expires_at)
        Server->>TG: POST /sendMessage { chat_id, text }
        TG-->>Faculty: Delivery OTP message in Telegram Chat
        Server-->>PWA: Return Success Response (200)
        PWA-->>Faculty: Render OTP Verification input form
    end

    Faculty->>PWA: Input OTP and click Verify
    PWA->>Server: POST /auth/verify-otp { telegram_id, otp }
    Server->>DB: Query latest unexpired OtpSession
    Server->>Server: Compare OTP using bcrypt
    alt Invalid OTP
        Server->>DB: Increment otp_failed_attempts
        Server-->>PWA: Return Error Response (401)
        PWA-->>Faculty: Display attempts remaining / lock error
    else Valid OTP
        Server->>DB: Reset otp_failed_attempts, verify session
        Server->>Server: Sign JWT token containing user ID & role
        Server-->>PWA: Send 200 OK + JWT in HttpOnly Cookie
        PWA-->>Faculty: Redirect to role dashboard (Faculty/Admin)
    end
```

---

### 4. Workflow: Scheduling & Need Cover Request Lifecycle
```mermaid
graph TD
    Start([Admin blocks holidays & sets working days]) --> Open[Admin opens picking window]
    Open --> Msg[Telegram notification sent to all active faculty]
    Msg --> Pick[Faculty picks slots online via SlotPickerPage]
    Pick -- Has picked required number of sessions? --> Done{Required slots picked?}
    Done -- Yes --> Complete[Scheduling window closes at end of month]
    Done -- No --> Close[Scheduling window closes]
    Close --> Assign[Admin manually assigns missing slots to faculty]
    Assign --> Scheduled([All slots scheduled for the month])

    Scheduled --> ActiveSlot[Faculty checks IN during slot window]
    ActiveSlot --> RecordViolations[Faculty records violations in real time]
    ActiveSlot --> CheckOut[Faculty checks OUT of session]
    ActiveSlot -- Unchecked OUT by 4:30 PM? --> AutoOut[System daily cron checks out faculty with auto_out=true]

    %% Cover flow
    Pick --> CoverRequest[Faculty posts Need Cover request]
    CoverRequest --> Volunteer[Any active faculty volunteers to cover]
    Volunteer --> AdminApproval{Admin confirms request?}
    AdminApproval -- Approved --> Swap[Duty slot reassigned to volunteer]
    AdminApproval -- Rejected --> CoverRequest
    CoverRequest -- Unanswered for 48 hours --> Expired[System hourly cron marks request as expired]
```

---

## 1. Software Architect Perspective

### Architecture & System Design
- **Monolithic Architecture**: Both the Express API backend and built static React assets are deployed together on **Railway**, maintaining a single deployment unit and simplifying network topology.
- **Data Query Synchronization**: Employs **TanStack React Query** with a default `staleTime` of 30 seconds and automatic polling intervals to ensure UI dashboard updates are real-time, removing complex infrastructural overheads like WebSockets or Server-Sent Events (SSE).
- **Service Worker integration**: Built using **VitePWA** (Workbox) configuration which registers an auto-updating service worker to precache only static build assets (HTML, CSS, JS, fonts, images). **API responses are intentionally never cached** — auth cookies, user data, violations, attendance, messages, and report data are sensitive and must always be fetched from the network to prevent stale or leaked data on shared devices.

### Security Implementation
- **httpOnly Cookies**: Authentication JSON Web Tokens (JWT) are strictly stored in `httpOnly` secure cookies. They are never written to `localStorage` or `sessionStorage`, securing the application against Cross-Site Scripting (XSS) token theft.
- **CSP & Helmet**: Employs Express Helmet with a tight Content Security Policy (CSP) tailored for Vite modules, Tailwind inline styles, and dynamic asset structures.
- **Rate Limiting**: Utilizes `express-rate-limit` globally and specifically targets login OTP validation.
- **Audit Trails**: Integrates two separate audit layers:
  - `violation_audit_log` (immutable tracking for student violation corrections/edits).
  - `admin_audit_log` (tracks administrative actions like session resets, settings updates, and soft deletes).

### Data Integrity Rules
- **No Sequential IDs**: Every primary key throughout all 15 schemas uses UUIDs (`@default(uuid())`), preventing enumeration attacks.
- **Soft Deletes**: Deletions are mapped as soft-deletes using the `deleted_at` field (except for Super Admin hard delete).
- **Exact Monetary Values**: Fines and financial figures are stored as `Decimal(8, 2)` instead of float, preventing rounding errors.

---

## 2. Software Developer Perspective

### Codebase Organization
The repository has a clean, decoupled monorepo structure:
- `/prisma`: Contains `schema.prisma` and database migrations.
- `/server`: Contains backend routing, controllers, middlewares, services, and script configurations.
- `/client`: React frontend compiled with Vite.
- `/specs`: Living documentation containing feature plans and checklist specs.

### Backend Design Patterns
- **Zod Validation Middleware**: Uses schemas (`server/schemas`) mapped to routes to guarantee request payload type safety and size restrictions before controllers execute.
- **MVC Architecture**: Routes bind controllers that execute logic, invoke Prisma query clients, log actions using Winston (`server/lib/logger`), and respond in a standardized JSON error envelope:
  ```json
  { "error": true, "code": "ERROR_CODE", "message": "Human-readable message" }
  ```

### Frontend Structure & Optimizations
- **Consolidated Tailwind CSS**: Consolidates layout styling into Tailwind CSS v4 utility classes and inline styles where dynamic variables (safe-area spacing, dynamic color configurations) are required, preventing competing CSS variables.
- **Protected Routes**: Utilizes the `ProtectedRoute` component enforcing strict role-based access:
  - Admin/Super Admin pages: `requiredRoles={['admin', 'super_admin']}`
  - Super Admin audit logs: `requiredRoles={['super_admin']}`
  - Faculty pages: `requiredRoles={['faculty']}` — Admin users cannot access faculty-only pages.

---

## 3. Product Manager Perspective

### Business Goals & Persona Alignment
The product aims to optimize operations for SIMS College of Pharmacy by substituting manual worksheets with a responsive dashboard tailored for three roles:

| Role | Core User Flow | Core Responsibilities |
|---|---|---|
| **Super Admin** | Admin management, system audits, server configuration | Manages admin accounts, updates system configs, clears locked login sessions |
| **Admin** | Student Excel ingestion, scheduling window controls, override approvals | Opens picking window, reviews attendance overrides, resolves flagged violations, exports reports |
| **Faculty** | Slot picking, checking In/Out, registering student violations | Schedules own monthly duties, checks in, logs infractions, requests coverage swap |

### Product Usability Features
- **OTP Lockout Safety**: If a faculty member reaches 5 failed OTP attempts, their account is locked. This secures credentials but is easily reset by a Super Admin via the user interface.
- **Need Cover Swapping**: Converts direct faculty rescheduling into a broadcast system. Faculty broadcast a request, another faculty member volunteers, and Admin confirms—saving hours of direct back-and-forth negotiation.
- **Late Check-In Flagging**: System monitors check-ins against config parameters (`late_threshold_morning_hour` etc.) and auto-clocks out faculty at 4:30 PM (or as configured) if checkout is forgotten.
- **Text-Only Violations**: Phase 1 skips image storage to avoid slow network uploads and high hosting costs on Railway, keeping the focus on fast text recording.

---

## Actionable Insights & Future Recommendations

1. **Required Production Environment Variables**:
   Set all variables from `.env.example` in Railway → Variables. Critical ones:
   - `TZ=Asia/Kolkata` — required for correct cron scheduling (auto clock-out, calendar auto-close) and IST date comparisons in attendance.
   - `CORS_ORIGIN` — must match your deployed frontend URL exactly (no trailing slash).
   - `JWT_SECRET` — use a 64+ hex character random string. Never reuse across environments.
   - `TELEGRAM_WEBHOOK_SECRET` — register this with Telegram when setting the webhook URL.
   - `APP_URL` — public URL of the deployed application.

2. **Authentication — httpOnly Cookie, Not localStorage**:
   After successful OTP verification the server sets a `sims_token` httpOnly cookie and a `sims_csrf` non-httpOnly cookie. The JWT is **never** placed in `localStorage` or `sessionStorage`. Any tool or script that tries to read a token from `localStorage` will find nothing.

3. **Telegram OTP Login Flow**:
   - User enters their **numeric Telegram User ID** (not `@username`) on the login page.
   - Server looks up the user by `telegram_id`, sends a 6-digit OTP via the Telegram bot.
   - User pastes the OTP on the verification screen.
   - Valid OTP sets the httpOnly `sims_token` and CSRF cookies and redirects to the dashboard.

4. **Recommended Account Creation (Invite Flow)**:
   Create users via Admin → Users → Create User **without** supplying a Telegram ID. The system generates a 7-day invite link (`https://t.me/BOT?start=invite_TOKEN`). Share this link with the new faculty member — when they start the bot, their Telegram account is linked and their status changes to `active`. Only then can they request an OTP and log in.

5. **CSRF Protection**:
   All authenticated POST/PUT/PATCH/DELETE requests require an `X-CSRF-Token` header matching the `sims_csrf` cookie. The Axios client reads this cookie automatically and attaches the header. Scripts or curl commands that use httpOnly cookie auth must also forward this token.

6. **Phase 2 Photo Upload Foundation**:
   Columns `photo_path` and `photo_expires_at` exist in the database, but endpoints return `501 NOT IMPLEMENTED`. As the app shifts to Phase 2, a secure presigned URL strategy (e.g., AWS S3 or Supabase Storage) should be implemented to support temporary attachment access while maintaining strict privacy boundaries.
