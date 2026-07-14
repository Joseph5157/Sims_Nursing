-- Phase 4.5: Prevent duplicate open cover requests
-- Add a partial unique index to ensure only one open request per duty_slot_id
-- This prevents race conditions when creating cover requests

CREATE UNIQUE INDEX "cover_requests_duty_slot_id_open_unique"
ON "cover_requests"("duty_slot_id")
WHERE status = 'open';
