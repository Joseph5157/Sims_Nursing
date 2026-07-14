-- Add activation_notification_failed flag to users table so Admins can see
-- when an invite activation succeeded (account created) but the temp-password
-- Telegram message failed to send after retries.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activation_notification_failed" BOOLEAN NOT NULL DEFAULT false;
