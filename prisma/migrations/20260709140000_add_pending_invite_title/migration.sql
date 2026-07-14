-- Add title field to pending_invites table, mirroring users.title — lets an
-- admin set the salutation ("Dr.", "Prof.", "Mr.") at invite time, same as designation.
ALTER TABLE "pending_invites" ADD COLUMN IF NOT EXISTS "title" VARCHAR(20);
