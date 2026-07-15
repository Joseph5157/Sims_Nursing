-- Add OTP cool-off timestamp to users (part of 024-telegram-otp-login lockout feature)
ALTER TABLE "users" ADD COLUMN "otp_locked_until" TIMESTAMP(3);

-- Create otp_login_codes table for 024-telegram-otp-login feature
-- Single-use, short-lived 6-digit codes delivered over Telegram
-- code_hash is bcrypt (NOT a fast hash) to survive a 1,000,000-value keyspace
CREATE TABLE "otp_login_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_login_codes_pkey" PRIMARY KEY ("id")
);

-- Index for user lookups
CREATE INDEX "otp_login_codes_user_id_idx" ON "otp_login_codes"("user_id");

-- Foreign key constraint
ALTER TABLE "otp_login_codes" ADD CONSTRAINT "otp_login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
