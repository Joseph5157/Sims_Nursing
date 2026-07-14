-- Admin Duty Timing Settings: split the single shared auto_checkout_hour/min
-- into per-session (morning/afternoon) columns, and add per-session
-- not-checked-in cutoff columns (previously nonexistent — the live attendance
-- dashboard had no time-gated "not checked in" concept at all).

-- 1. Not-checked-in cutoff — new concept, static defaults (data-model.md).
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "not_checked_in_morning_hour" SMALLINT NOT NULL DEFAULT 8;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "not_checked_in_morning_min" SMALLINT NOT NULL DEFAULT 30;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "not_checked_in_afternoon_hour" SMALLINT NOT NULL DEFAULT 13;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "not_checked_in_afternoon_min" SMALLINT NOT NULL DEFAULT 30;

-- 2. Per-session auto clock-out — added nullable first so we can backfill
-- from the existing shared auto_checkout_hour/min (which may have been
-- changed by an Admin away from the 16:30 default), preserving current
-- behavior for both sessions before the shared columns are dropped (FR-007).
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "auto_checkout_morning_hour" SMALLINT;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "auto_checkout_morning_min" SMALLINT;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "auto_checkout_afternoon_hour" SMALLINT;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "auto_checkout_afternoon_min" SMALLINT;

UPDATE "system_config" SET
  "auto_checkout_morning_hour"   = "auto_checkout_hour",
  "auto_checkout_morning_min"    = "auto_checkout_min",
  "auto_checkout_afternoon_hour" = "auto_checkout_hour",
  "auto_checkout_afternoon_min"  = "auto_checkout_min";

ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_morning_hour" SET DEFAULT 16;
ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_morning_min" SET DEFAULT 30;
ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_afternoon_hour" SET DEFAULT 16;
ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_afternoon_min" SET DEFAULT 30;

ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_morning_hour" SET NOT NULL;
ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_morning_min" SET NOT NULL;
ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_afternoon_hour" SET NOT NULL;
ALTER TABLE "system_config" ALTER COLUMN "auto_checkout_afternoon_min" SET NOT NULL;

-- 3. Drop the now-superseded shared columns.
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "auto_checkout_hour";
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "auto_checkout_min";
