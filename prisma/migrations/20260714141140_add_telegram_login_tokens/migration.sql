-- DropForeignKey
ALTER TABLE "violations" DROP CONSTRAINT "violations_duty_slot_id_fkey";

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "year" DROP DEFAULT,
ALTER COLUMN "semester" DROP DEFAULT,
ALTER COLUMN "batch_year" DROP DEFAULT;

-- CreateTable
CREATE TABLE "telegram_login_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_login_tokens_token_key" ON "telegram_login_tokens"("token");

-- CreateIndex
CREATE INDEX "telegram_login_tokens_user_id_idx" ON "telegram_login_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "telegram_login_tokens" ADD CONSTRAINT "telegram_login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_duty_slot_id_fkey" FOREIGN KEY ("duty_slot_id") REFERENCES "duty_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
