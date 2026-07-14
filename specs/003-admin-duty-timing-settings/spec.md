# Feature Specification: Admin Duty Timing Settings

**Feature Branch**: `003-admin-duty-timing-settings`

**Created**: 2026-07-06

**Status**: Draft

**Input**: Client feedback round — item 17 from SIMS_DMS_Client_Feedback_Resolution.docx. College session timings occasionally change, so Morning/Afternoon session start times, late-arrival cutoff, not-checked-in cutoff, and auto clock-out time must become admin-configurable instead of hardcoded. This replaces the fixed 9:00 AM / 2:00 PM / 4:30 PM values recorded in CONSTITUTION.md v2.6.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Configures Session and Cutoff Times (Priority: P1)

An Admin opens a new Duty Timing Settings page and sets the Morning and Afternoon session start times, the late-arrival cutoff for each, the not-checked-in cutoff, and the auto clock-out time for each session.

**Why this priority**: Without this, every downstream timing rule (late flagging, auto clock-out, attendance status) stays hardcoded and cannot adapt to real college schedule changes — the entire point of this feature.

**Independent Test**: Log in as Admin, change the Morning session start time and late cutoff, save, and confirm the new values persist and are reflected in a subsequent attendance check-in test.

**Acceptance Scenarios**:

1. **Given** a logged-in Admin, **When** they open Duty Timing Settings, **Then** they see current values for: Morning session start, Afternoon session start, Morning late cutoff, Afternoon late cutoff, not-checked-in cutoff (per session), and auto clock-out time (per session).
2. **Given** a logged-in Admin, **When** they update any of these values and save, **Then** the new values are persisted and take effect immediately for future check-ins/clock-outs (not retroactively for already-completed attendance records).
3. **Given** a non-Admin, non-Super-Admin user, **When** they attempt to access Duty Timing Settings, **Then** access is denied.
4. **Given** an Admin enters an invalid time configuration (e.g., late cutoff earlier than session start, or auto clock-out earlier than late cutoff), **When** they attempt to save, **Then** the system rejects the change with a clear validation message.

---

### User Story 2 — Late Arrival Flagging Uses Configured Cutoff (Priority: P1)

When a faculty member checks in, the system flags them as late based on the Admin-configured cutoff for that session, not a hardcoded time.

**Why this priority**: This is the core behavior the setting exists to control; without it wired through, the settings page is cosmetic only.

**Independent Test**: Set Morning late cutoff to 9:15 AM; check in a faculty member at 9:16 AM; confirm `in_status = late`. Check in another at 9:10 AM; confirm `in_status = normal`.

**Acceptance Scenarios**:

1. **Given** a configured Morning late cutoff of 9:15 AM, **When** a faculty member checks in after 9:15 AM, **Then** `duty_attendance.in_status` is set to `late`.
2. **Given** the same configuration, **When** a faculty member checks in at or before 9:15 AM, **Then** `in_status` is set to `normal`.
3. **Given** Admin changes the late cutoff mid-month, **When** faculty check in after the change, **Then** the new cutoff applies; attendance records created before the change are not retroactively altered.

---

### User Story 3 — Not-Checked-In Status Uses Configured Cutoff (Priority: P2)

A faculty member who has not checked in by the Admin-configured "not checked in" cutoff time is marked accordingly, visible on the live attendance dashboard.

**Why this priority**: Gives Admin real-time visibility into no-shows using a college-adjustable threshold rather than a fixed rule.

**Independent Test**: Set not-checked-in cutoff to 9:30 AM for Morning session; leave a scheduled faculty member unchecked-in past that time; confirm they appear as "Not Checked In" on the live attendance view.

**Acceptance Scenarios**:

1. **Given** a configured not-checked-in cutoff, **When** the cutoff time passes for a scheduled faculty member with no check-in, **Then** they appear as "Not Checked In" on the Admin live attendance dashboard within the existing 30-second polling interval.
2. **Given** the faculty member checks in after this point, **When** the attendance view refreshes, **Then** their status updates to reflect the actual (likely late) check-in rather than remaining "Not Checked In."

---

### User Story 4 — Auto Clock-Out Uses Configured Time Per Session (Priority: P1)

The system automatically clocks out any faculty member who has not checked out, using the Admin-configured auto clock-out time for their session, instead of a fixed 4:30 PM for all sessions.

**Why this priority**: Currently hardcoded to a single time regardless of session; must respect per-session configuration (e.g., Morning auto clock-out at 12:00 PM, Afternoon at 5:00 PM) as requested by the client.

**Independent Test**: Configure Morning auto clock-out at 12:00 PM and Afternoon at 5:00 PM; leave a Morning-session faculty member checked in without checkout; confirm the cron clocks them out at 12:00 PM with `auto_out = true`, and that Afternoon-session faculty are unaffected by the Morning cutoff.

**Acceptance Scenarios**:

1. **Given** configured auto clock-out times per session, **When** the cron job runs at or after a session's configured auto clock-out time, **Then** any faculty still checked in for that session are clocked out with `out_status = auto` and `auto_out = true`.
2. **Given** two different sessions with two different configured auto clock-out times, **When** the cron evaluates each, **Then** each session is auto-clocked-out only at its own configured time, not a single shared time.

---

### Edge Cases

- What happens if Admin sets Afternoon session start time earlier than Morning session start time (schedule conflict)?
- What happens to a duty slot's attendance rules if Admin changes timing settings while faculty are actively checked in mid-session?
- What is shown in historical reports for attendance recorded under a previous timing configuration — do reports reflect the rule in effect at the time, or the current rule?
- What happens if Admin sets a not-checked-in cutoff later than the session's own auto clock-out time?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an Admin/Super-Admin-only settings page to configure: Morning session start time, Afternoon session start time, Morning late-arrival cutoff, Afternoon late-arrival cutoff, not-checked-in cutoff (per session), and auto clock-out time (per session).
- **FR-002**: System MUST persist these settings so they are not hardcoded in application code.
- **FR-003**: System MUST validate that late cutoff, not-checked-in cutoff, and auto clock-out times occur in a sensible order after each session's start time before allowing a save.
- **FR-004**: System MUST use the currently configured late-arrival cutoff (per session) when computing `duty_attendance.in_status` at check-in time.
- **FR-005**: System MUST use the currently configured not-checked-in cutoff (per session) to flag not-checked-in faculty on the live attendance dashboard.
- **FR-006**: System MUST use the currently configured auto clock-out time (per session) in the auto-clock-out cron job, replacing the single fixed 4:30 PM rule.
- **FR-007**: System MUST apply timing configuration changes only to attendance events occurring after the change — existing attendance records are not retroactively recalculated.
- **FR-008**: System MUST restrict access to Duty Timing Settings to Admin and Super Admin roles only.
- **FR-009**: These configured timings MUST be the single source of truth used across My Slots, Attendance, Dashboard, Student Violation recording, Reports, and the auto clock-out cron — no module may retain its own hardcoded copy of these values.

### Key Entities

- **Duty Timing Settings**: Configuration record holding per-session start time, late cutoff, not-checked-in cutoff, and auto clock-out time. Editable by Admin/Super Admin only.

---

## Success Criteria *(mandatory)*

- **SC-001**: Admin can view and update all five timing values from a single settings screen without needing developer/database intervention.
- **SC-002**: Late-arrival flagging, not-checked-in flagging, and auto clock-out all reflect the currently configured values in 100% of test cases, with zero hardcoded fallback values remaining in code.
- **SC-003**: Changing a timing setting does not alter any previously recorded attendance record.
- **SC-004**: Invalid timing configurations (e.g., cutoff before session start) are rejected 100% of the time with a clear error message.

---

## Assumptions

- This feature replaces the fixed 9:00 AM / 2:00 PM session times and 4:30 PM auto clock-out rule recorded in `CONSTITUTION.md` v2.6; the constitution must be updated to v2.7 before or alongside this implementation.
- A schema addition is required — either new columns on `calendar_config` or a new dedicated settings table — to be decided during `/plan`.
- Settings apply system-wide (not per-department or per-faculty) unless the project owner specifies otherwise during clarification.
