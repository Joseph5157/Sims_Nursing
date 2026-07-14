-- Admin override recording: an admin can record a student violation directly,
-- with no duty slot (outside any duty session). Make duty_slot_id nullable so
-- those ad-hoc records need no slot. `faculty_id` stays the generic recorder
-- (a faculty member on duty, or an admin). For a slot-less record the effective
-- date is `created_at` (see reports date-filter fallback).
ALTER TABLE "violations" ALTER COLUMN "duty_slot_id" DROP NOT NULL;
