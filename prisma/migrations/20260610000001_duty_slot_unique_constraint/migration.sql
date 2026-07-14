-- Phase 2: unique constraint on duty_slots(duty_date, session_type)
-- Ensures no two faculty can be assigned the same date+session globally.
CREATE UNIQUE INDEX "duty_slots_duty_date_session_type_key" ON "duty_slots"("duty_date", "session_type");
