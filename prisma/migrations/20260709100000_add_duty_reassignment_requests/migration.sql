-- Faculty-to-faculty duty reassignment requests (Method 2 alongside the
-- existing Admin Duty Reassignment). The DutyReassignmentRequest model was
-- added to schema.prisma earlier but never migrated — this creates the
-- actual table to match.

CREATE TABLE "duty_reassignment_requests" (
    "id" TEXT NOT NULL,
    "duty_slot_id" TEXT NOT NULL,
    "from_faculty_id" TEXT NOT NULL,
    "to_faculty_id" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responded_by_id" TEXT,
    "response_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_reassignment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "duty_reassignment_requests_from_faculty_id_idx" ON "duty_reassignment_requests"("from_faculty_id");
CREATE INDEX "duty_reassignment_requests_to_faculty_id_idx" ON "duty_reassignment_requests"("to_faculty_id");
CREATE INDEX "duty_reassignment_requests_status_idx" ON "duty_reassignment_requests"("status");

ALTER TABLE "duty_reassignment_requests" ADD CONSTRAINT "duty_reassignment_requests_duty_slot_id_fkey" FOREIGN KEY ("duty_slot_id") REFERENCES "duty_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "duty_reassignment_requests" ADD CONSTRAINT "duty_reassignment_requests_from_faculty_id_fkey" FOREIGN KEY ("from_faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duty_reassignment_requests" ADD CONSTRAINT "duty_reassignment_requests_to_faculty_id_fkey" FOREIGN KEY ("to_faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duty_reassignment_requests" ADD CONSTRAINT "duty_reassignment_requests_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
