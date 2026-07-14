-- Add FK indexes on hot-path columns that Postgres does not auto-index (ISSUE-19).
-- violations(violation_type_id): used by the violation-type breakdown report.
-- messages(from_user_id): standalone FK lookup index; composite (from_user_id, created_at)
--   covers sorted sent-items queries, this covers unsorted FK-style lookups.
CREATE INDEX "violations_violation_type_id_idx" ON "violations"("violation_type_id");
CREATE INDEX "messages_from_user_id_idx" ON "messages"("from_user_id");
