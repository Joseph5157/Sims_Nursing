-- Add title field to users table: salutation shown in dashboard greetings
-- ("Dr.", "Prof.", "Mr.", etc.) — distinct from designation (job title).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "title" VARCHAR(20);
