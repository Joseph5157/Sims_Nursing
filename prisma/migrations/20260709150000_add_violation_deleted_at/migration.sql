-- Add deleted_at to violations: soft-delete replacing the Hide/Log actions.
-- A deleted violation is excluded from every read path (lists, counts, dashboards,
-- reports, analytics) but the row is kept, consistent with the constitution's
-- "all deletes are soft deletes" rule — only Super Admin can hard-delete.
ALTER TABLE "violations" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
