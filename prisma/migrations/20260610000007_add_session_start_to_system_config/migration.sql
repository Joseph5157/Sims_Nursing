-- Add session window start columns to system_config (ISSUE-04)
-- Enables configurable per-session check-in windows enforced in checkIn().
-- Grace period of 30 minutes before session start is applied in application code.
ALTER TABLE "system_config" ADD COLUMN "session_start_morning_hour"   SMALLINT NOT NULL DEFAULT 8;
ALTER TABLE "system_config" ADD COLUMN "session_start_morning_min"    SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "system_config" ADD COLUMN "session_start_afternoon_hour" SMALLINT NOT NULL DEFAULT 13;
ALTER TABLE "system_config" ADD COLUMN "session_start_afternoon_min"  SMALLINT NOT NULL DEFAULT 0;
