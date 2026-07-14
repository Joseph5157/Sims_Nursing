-- P23: Student.section is unused everywhere in the UI (Year/Semester are already
-- independent columns/fields) — dropped per project owner decision (full removal,
-- not just a code-level stop-using).
ALTER TABLE "students" DROP COLUMN IF EXISTS "section";

-- P26 item 4: the not-checked-in cutoff concept is removed entirely. A faculty
-- member who hasn't checked in is now always shown "Not checked in" from session
-- start until auto clock-out — no separate time-gated intermediate stage.
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "not_checked_in_morning_hour";
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "not_checked_in_morning_min";
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "not_checked_in_afternoon_hour";
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "not_checked_in_afternoon_min";
