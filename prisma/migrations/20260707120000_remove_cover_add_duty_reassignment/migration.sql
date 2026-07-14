-- Remove the Cover Request / Volunteer workflow entirely and replace it with
-- Admin-controlled Duty Reassignment.

-- 1. Drop the cover_requests table (removes all of its foreign keys).
DROP TABLE "cover_requests";

-- 2. Drop the now-unused CoverStatus enum type.
DROP TYPE "CoverStatus";

-- 3. Drop duty_slots.covered_by (foreign key + column).
ALTER TABLE "duty_slots" DROP CONSTRAINT "duty_slots_covered_by_fkey";
ALTER TABLE "duty_slots" DROP COLUMN "covered_by";

-- 4. Retire the cover-related SlotStatus values. Postgres cannot drop enum
--    values in place, so collapse any existing cover_pending/covered slots back
--    to 'scheduled' and recreate the type without them.
ALTER TABLE "duty_slots" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "duty_slots" SET "status" = 'scheduled' WHERE "status" IN ('cover_pending', 'covered');
ALTER TYPE "SlotStatus" RENAME TO "SlotStatus_old";
CREATE TYPE "SlotStatus" AS ENUM ('scheduled', 'completed', 'absent');
ALTER TABLE "duty_slots" ALTER COLUMN "status" TYPE "SlotStatus" USING ("status"::text::"SlotStatus");
ALTER TABLE "duty_slots" ALTER COLUMN "status" SET DEFAULT 'scheduled';
DROP TYPE "SlotStatus_old";

-- 5. Drop cover-request configuration columns.
ALTER TABLE "calendar_config" DROP COLUMN "max_cover_requests_per_slot";
ALTER TABLE "system_config" DROP COLUMN "cover_ttl_hours";

-- 6. Create the duty_reassignments history table.
CREATE TABLE "duty_reassignments" (
    "id" TEXT NOT NULL,
    "duty_slot_id" TEXT NOT NULL,
    "from_faculty_id" TEXT NOT NULL,
    "to_faculty_id" TEXT NOT NULL,
    "duty_date" DATE NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "reason" TEXT,
    "reassigned_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duty_reassignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "duty_reassignments_from_faculty_id_idx" ON "duty_reassignments"("from_faculty_id");
CREATE INDEX "duty_reassignments_to_faculty_id_idx" ON "duty_reassignments"("to_faculty_id");
CREATE INDEX "duty_reassignments_duty_slot_id_idx" ON "duty_reassignments"("duty_slot_id");

ALTER TABLE "duty_reassignments" ADD CONSTRAINT "duty_reassignments_duty_slot_id_fkey" FOREIGN KEY ("duty_slot_id") REFERENCES "duty_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duty_reassignments" ADD CONSTRAINT "duty_reassignments_from_faculty_id_fkey" FOREIGN KEY ("from_faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duty_reassignments" ADD CONSTRAINT "duty_reassignments_to_faculty_id_fkey" FOREIGN KEY ("to_faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duty_reassignments" ADD CONSTRAINT "duty_reassignments_reassigned_by_fkey" FOREIGN KEY ("reassigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
