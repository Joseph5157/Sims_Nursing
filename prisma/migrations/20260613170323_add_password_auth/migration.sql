-- Add password_hash and must_change_password columns to users table
ALTER TABLE "users" ADD COLUMN "password_hash" VARCHAR(255),
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true;

-- Drop the otp_sessions table (no longer needed with password auth)
DROP TABLE "otp_sessions";
