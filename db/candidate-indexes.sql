-- ─────────────────────────────────────────────────────────────────────────────
-- CANDIDATE indexes — DO NOT APPLY BLINDLY.
--
-- Apply an index from this file ONLY after db/index-diagnostics.sql shows, for
-- that specific query, ALL THREE of:
--   (a) the table is large or clearly growing (diagnostics §1), AND
--   (b) EXPLAIN ANALYZE shows a Seq Scan whose "Rows Removed by Filter" is most
--       of the table AND whose time dominates the query (diagnostics §3), AND
--   (c) the rolled-back trial index (diagnostics §4) actually changes the plan.
--
-- At the current stated scale (~20–30 faculty), most of these will FAIL test (a)
-- and should NOT be added — the seq scan is already sub-millisecond and correct.
-- Re-evaluate as violations/students volumes grow.
--
-- ── How to apply, once justified ─────────────────────────────────────────────
-- Two options, pick per how big the table is:
--
--   SMALL/MEDIUM table (locking write for <1s is fine): keep Prisma as the source
--   of truth — add the matching `@@index(...)` to prisma/schema.prisma (see the
--   note on each index below) and run `npm run migrate`. Prisma emits a plain
--   CREATE INDEX. No drift.
--
--   LARGE / hot table (can't afford the brief exclusive lock): run the
--   CONCURRENTLY statement below MANUALLY (psql, autocommit — CONCURRENTLY cannot
--   run inside a transaction, so it can't live in a normal Prisma migration), then
--   ALSO add the `@@index` to schema.prisma and reconcile with
--   `prisma migrate resolve` / a no-op migration so Prisma doesn't try to recreate
--   it. Document the manual step in the feature handoff.
--
-- Every statement is idempotent (IF NOT EXISTS) and reversible (DROP at bottom).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── C1. violations — soft-delete + recorder ordering ─────────────────────────
-- Serves: listViolations / myViolations (WHERE deleted_at IS NULL [+ faculty_id]
--         ORDER BY created_at DESC). Partial + composite: smaller than a bare
--         deleted_at index and matches the exact predicate/ordering.
-- schema.prisma equivalent: @@index([faculty_id, created_at]) on Violation
--   (Prisma can't express the partial WHERE — use raw SQL if you want the partial
--    form; the non-partial composite is a fine second-best and Prisma-native.)
-- Go/no-go: only if `violations` grows past a few thousand rows (diagnostics §1).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_violations_faculty_created
  ON violations (faculty_id, created_at DESC)
  WHERE deleted_at IS NULL;


-- ── C2. users — role + status lookups ────────────────────────────────────────
-- Serves: listUsers, eligible-faculty, directory (role='faculty' AND
--         status='active' AND deleted_at IS NULL). users is TINY (~20–30 rows) —
--         this will almost certainly NOT be used; included only for completeness.
-- schema.prisma equivalent: @@index([role, status]) on User.
-- Go/no-go: realistically NEVER at this scale. Leave unless the table grows by 100x.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status
  ON users (role, status)
  WHERE deleted_at IS NULL;


-- ── C3. students — active-roster filters ─────────────────────────────────────
-- Serves: listStudents (WHERE deleted_at IS NULL AND status=... [+ course/year]).
--         Does NOT help the name/reg ILIKE '%q%' search — that needs pg_trgm
--         (separate decision; see note).
-- schema.prisma equivalent: @@index([status, course, year]) on Student.
-- Go/no-go: only once the student master is large (thousands) AND filtered lists
--           show a costly seq scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_status_course_year
  ON students (status, course, year)
  WHERE deleted_at IS NULL;


-- ── C4. duty_slots — status within a month ───────────────────────────────────
-- Serves: absentFacultyReport, monthlyDutyCoverage (duty_date range + status).
--         CHECK FIRST: the existing (faculty_id, duty_date) and unique
--         (duty_date, session_type) indexes may already satisfy the date range;
--         status is very low-cardinality (3 values) so an index on it rarely pays.
-- schema.prisma equivalent: @@index([duty_date, status]) on DutySlot.
-- Go/no-go: likely NO — low-cardinality status + already-indexed date. Verify with §3e.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_duty_slots_date_status
  ON duty_slots (duty_date, status);


-- ── C5. admin_audit_log — timeline + actor filter ────────────────────────────
-- Serves: getAuditLogs (WHERE [actor_id] [created_at range] ORDER BY created_at
--         DESC). This table only ever grows (append-only), so it is the STRONGEST
--         candidate here — audit rows accumulate for the life of the system.
-- schema.prisma equivalent: @@index([created_at]) and @@index([actor_id]) on AdminAuditLog.
-- Go/no-go: add once the audit log passes a few thousand rows (it will, over time).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_created
  ON admin_audit_log (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_audit_actor
  ON admin_audit_log (actor_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- REVERSAL (safe, non-locking):
--   DROP INDEX CONCURRENTLY IF EXISTS idx_violations_faculty_created;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_users_role_status;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_students_status_course_year;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_duty_slots_date_status;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_admin_audit_created;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_admin_audit_actor;
-- ─────────────────────────────────────────────────────────────────────────────
