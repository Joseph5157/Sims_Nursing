-- Add avatar field to users table: one of male_professor, female_professor,
-- admin, super_admin, or NULL (falls back to initials in the UI).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" VARCHAR(30);
