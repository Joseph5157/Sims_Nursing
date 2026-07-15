-- Add institution-controlled short SIMS IDs.
-- 1000-1099: super_admin/admin
-- 1100-9999: faculty

ALTER TABLE "users" ADD COLUMN "sims_id" INTEGER;
ALTER TABLE "pending_invites" ADD COLUMN "sims_id" INTEGER;

-- Email remains available for contact and legacy password login, but is no
-- longer required for Telegram-first onboarding.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "pending_invites" ALTER COLUMN "email" DROP NOT NULL;

DO $$
DECLARE
  admin_count INTEGER;
  faculty_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM (
    SELECT id FROM "users" WHERE role IN ('admin', 'super_admin')
    UNION ALL
    SELECT id FROM "pending_invites" WHERE role = 'admin'
  ) x;

  SELECT COUNT(*) INTO faculty_count
  FROM (
    SELECT id FROM "users" WHERE role = 'faculty'
    UNION ALL
    SELECT id FROM "pending_invites" WHERE role = 'faculty'
  ) x;

  IF admin_count > 100 THEN
    RAISE EXCEPTION 'Cannot allocate 1000-series SIMS IDs: % admin records exceed the 100-ID range', admin_count;
  END IF;

  IF faculty_count > 8900 THEN
    RAISE EXCEPTION 'Cannot allocate four-digit faculty SIMS IDs: % faculty records exceed capacity', faculty_count;
  END IF;
END $$;

-- Existing users get the earliest IDs, preserving creation order.
WITH ranked AS (
  SELECT id, (999 + ROW_NUMBER() OVER (ORDER BY created_at, id))::INTEGER AS assigned_id
  FROM "users"
  WHERE role IN ('admin', 'super_admin')
)
UPDATE "users" u
SET "sims_id" = ranked.assigned_id
FROM ranked
WHERE u.id = ranked.id;

WITH ranked AS (
  SELECT id, (1099 + ROW_NUMBER() OVER (ORDER BY created_at, id))::INTEGER AS assigned_id
  FROM "users"
  WHERE role = 'faculty'
)
UPDATE "users" u
SET "sims_id" = ranked.assigned_id
FROM ranked
WHERE u.id = ranked.id;

-- Pending invites continue after allocated user IDs so no identifier can be
-- duplicated if an older invite is activated later.
WITH base AS (
  SELECT COALESCE(MAX(sims_id), 999) AS last_id
  FROM "users"
  WHERE role IN ('admin', 'super_admin')
), ranked AS (
  SELECT p.id, (base.last_id + ROW_NUMBER() OVER (ORDER BY p.created_at, p.id))::INTEGER AS assigned_id
  FROM "pending_invites" p CROSS JOIN base
  WHERE p.role = 'admin'
)
UPDATE "pending_invites" p
SET "sims_id" = ranked.assigned_id
FROM ranked
WHERE p.id = ranked.id;

WITH base AS (
  SELECT COALESCE(MAX(sims_id), 1099) AS last_id
  FROM "users"
  WHERE role = 'faculty'
), ranked AS (
  SELECT p.id, (base.last_id + ROW_NUMBER() OVER (ORDER BY p.created_at, p.id))::INTEGER AS assigned_id
  FROM "pending_invites" p CROSS JOIN base
  WHERE p.role = 'faculty'
)
UPDATE "pending_invites" p
SET "sims_id" = ranked.assigned_id
FROM ranked
WHERE p.id = ranked.id;

ALTER TABLE "users" ALTER COLUMN "sims_id" SET NOT NULL;
ALTER TABLE "pending_invites" ALTER COLUMN "sims_id" SET NOT NULL;

CREATE UNIQUE INDEX "users_sims_id_key" ON "users"("sims_id");
CREATE UNIQUE INDEX "pending_invites_sims_id_key" ON "pending_invites"("sims_id");

ALTER TABLE "users" ADD CONSTRAINT "users_sims_id_range_check"
  CHECK (
    (role IN ('admin', 'super_admin') AND sims_id BETWEEN 1000 AND 1099)
    OR (role = 'faculty' AND sims_id BETWEEN 1100 AND 9999)
  );

ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_sims_id_range_check"
  CHECK (
    (role = 'admin' AND sims_id BETWEEN 1000 AND 1099)
    OR (role = 'faculty' AND sims_id BETWEEN 1100 AND 9999)
  );

CREATE TABLE "sims_id_counters" (
  "series" VARCHAR(20) NOT NULL,
  "last_value" INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sims_id_counters_pkey" PRIMARY KEY ("series")
);

INSERT INTO "sims_id_counters" ("series", "last_value") VALUES
  ('admin', GREATEST(
    COALESCE((SELECT MAX(sims_id) FROM "users" WHERE role IN ('admin', 'super_admin')), 999),
    COALESCE((SELECT MAX(sims_id) FROM "pending_invites" WHERE role = 'admin'), 999)
  )),
  ('faculty', GREATEST(
    COALESCE((SELECT MAX(sims_id) FROM "users" WHERE role = 'faculty'), 1099),
    COALESCE((SELECT MAX(sims_id) FROM "pending_invites" WHERE role = 'faculty'), 1099)
  ));
