/*
  Warnings:

  - You are about to drop the column `telegram_invite_expires_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_invite_token` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "messages_from_user_id_created_at_idx";

-- DropIndex
DROP INDEX "messages_to_user_id_created_at_idx";

-- DropIndex
DROP INDEX "users_telegram_invite_token_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "telegram_invite_expires_at",
DROP COLUMN "telegram_invite_token",
ADD COLUMN     "last_password_reset_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "messages_to_user_id_created_at_idx" ON "messages"("to_user_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_from_user_id_created_at_idx" ON "messages"("from_user_id", "created_at");
