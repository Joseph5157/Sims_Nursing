-- ─────────────────────────────────────────────────────────────────────────────
-- Index diagnostics — READ ONLY. Run this against PRODUCTION before adding any
-- index from db/candidate-indexes.sql. Nothing here modifies data or schema.
--
-- How to run (Railway):
--   railway connect Postgres          # opens psql against the prod DB
--   \i db/index-diagnostics.sql        # or paste sections individually
--
-- Purpose: gather the evidence the audit (ADMIN-MED-003) says to gather BEFORE
-- adding indexes — real table sizes, existing index usage, and EXPLAIN ANALYZE
-- of the actual controller queries — so we only add indexes Postgres will use.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Table sizes & row counts ──────────────────────────────────────────────
-- Decision input: on small tables (rule of thumb < ~a few thousand live rows)
-- the planner will seq-scan regardless of any index, because a scan of a tiny
-- heap is cheaper than an index lookup. An index on such a table is dead weight
-- (write cost + storage, never used). Only tables that are BIG or clearly
-- GROWING are index candidates.
SELECT
  relname                                             AS table,
  n_live_tup                                          AS live_rows,
  n_dead_tup                                          AS dead_rows,
  pg_size_pretty(pg_relation_size(relid))             AS heap_size,
  pg_size_pretty(pg_indexes_size(relid))              AS indexes_size,
  pg_size_pretty(pg_total_relation_size(relid))       AS total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;


-- ── 2. Existing index usage (also finds UNUSED / redundant indexes) ───────────
-- idx_scan = 0 after the app has been live a while ⇒ the index is never used and
-- is a candidate for REMOVAL, not something to add more of. This catches the
-- "redundant/duplicate index" half of the audit too.
SELECT
  s.relname                                    AS table,
  s.indexrelname                               AS index,
  s.idx_scan                                   AS times_used,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
  i.indisunique                                AS is_unique
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
ORDER BY s.idx_scan ASC, pg_relation_size(s.indexrelid) DESC;


-- ── 3. EXPLAIN ANALYZE of the real queries the candidate indexes would serve ──
-- Read the "Seq Scan" vs "Index Scan" node, "Rows Removed by Filter", and actual
-- time. A Seq Scan is only a PROBLEM when the table is large AND the filter
-- throws away most rows AND that scan dominates runtime. On a tiny table a Seq
-- Scan taking <1ms is the correct plan — do NOT index it.
--
-- (These mirror server/controllers/*.controller.js. UUIDs are pulled live so the
-- script is runnable without hand-editing.)

-- 3a. Violations list — filtered by deleted_at, ordered by created_at
--     (violations.controller.js listViolations). Candidate: [deleted_at],
--     [faculty_id, created_at].
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM violations
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

-- 3b. Violations for one student (detail / delete-guard path)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM violations
WHERE deleted_at IS NULL
  AND student_id = (SELECT id FROM students LIMIT 1)
ORDER BY created_at DESC
LIMIT 20;

-- 3c. Users list & eligible-faculty — role + status + deleted_at
--     (users.controller.js listUsers / duty-reassignment-requests eligible).
--     Candidate: [role, status].
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name FROM users
WHERE role = 'faculty' AND status = 'active' AND deleted_at IS NULL
ORDER BY name ASC;

-- 3d. Students list — deleted_at + status (+ course/year)
--     (students.controller.js listStudents). Candidate: [status, deleted_at].
--     NOTE: the name/reg ILIKE '%q%' search CANNOT use a plain btree index —
--     it needs pg_trgm. Do not add a btree index expecting to speed up search.
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM students
WHERE deleted_at IS NULL AND status = 'active' AND course = 'b_pharm'
ORDER BY year ASC, semester ASC, student_name ASC
LIMIT 20;

-- 3e. Absent-faculty report — duty_date range + status
--     (reports.controller.js absentFacultyReport). Candidate: [status] or
--     [duty_date, status]. NB: an index already exists on (faculty_id, duty_date)
--     and the unique (duty_date, session_type) — check whether either is already
--     enough before adding another.
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM duty_slots
WHERE duty_date BETWEEN '2026-07-01' AND '2026-07-31'
  AND status = 'absent'
ORDER BY duty_date ASC;

-- 3f. Audit log — filter by actor, order by created_at desc
--     (users.controller.js getAuditLogs). admin_audit_log has NO index but PK.
--     Candidate: [created_at], [actor_id].
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM admin_audit_log
WHERE actor_id = (SELECT id FROM users LIMIT 1)
ORDER BY created_at DESC
LIMIT 50;


-- ── 4. Optional: prove an index would actually be used, WITHOUT committing ────
-- Wrap a trial index in a rolled-back transaction to see if the plan changes.
-- Because it's ROLLBACK, nothing persists. (Do this only on a table big enough
-- that §1 flagged it; skip for tiny tables.)
--
--   BEGIN;
--   CREATE INDEX tmp_probe ON admin_audit_log (created_at DESC);
--   EXPLAIN (ANALYZE, BUFFERS)
--     SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 50;
--   ROLLBACK;   -- index is discarded; if the plan didn't switch to it, don't add it
