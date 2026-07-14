-- Restructure students table: add structured fields, make legacy fields nullable

-- Add new structured columns (with safe defaults for any existing rows)
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "year"       INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "semester"   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "section"    VARCHAR(5),
  ADD COLUMN IF NOT EXISTS "batch_year" INTEGER NOT NULL DEFAULT 2024,
  ADD COLUMN IF NOT EXISTS "gender"     VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "phone"      VARCHAR(20);

-- Shrink course column (was VARCHAR(50), now VARCHAR(20))
ALTER TABLE "students"
  ALTER COLUMN "course" TYPE VARCHAR(20);

-- Make legacy fields nullable (they remain for backward compat but are no longer required)
ALTER TABLE "students"
  ALTER COLUMN "semester_or_year" DROP NOT NULL,
  ALTER COLUMN "institution"      DROP NOT NULL;
