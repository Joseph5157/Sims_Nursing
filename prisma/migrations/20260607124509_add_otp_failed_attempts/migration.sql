-- AlterTable
ALTER TABLE "users" ADD COLUMN     "otp_failed_attempts" SMALLINT NOT NULL DEFAULT 0;
