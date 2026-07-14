-- Add last_password_reset_at field to users table for password reset rate limiting
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_password_reset_at" TIMESTAMP(3);
