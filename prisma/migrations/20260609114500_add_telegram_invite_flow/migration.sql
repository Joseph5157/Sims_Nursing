-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'pending_telegram' BEFORE 'pending';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "telegram_invite_token" VARCHAR(100),
ADD COLUMN "telegram_invite_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_invite_token_key" ON "users"("telegram_invite_token");
