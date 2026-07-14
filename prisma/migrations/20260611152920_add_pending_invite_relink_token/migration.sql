-- CreateTable PendingInvite
CREATE TABLE "pending_invites" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "role" "Role" NOT NULL,
    "department" VARCHAR(100),
    "designation" VARCHAR(100),
    "invite_token" VARCHAR(100) NOT NULL,
    "invite_expires_at" TIMESTAMP(3) NOT NULL,
    "invited_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable TelegramRelinkToken
CREATE TABLE "telegram_relink_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_relink_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for PendingInvite unique constraints
CREATE UNIQUE INDEX "pending_invites_email_key" ON "pending_invites"("email");
CREATE UNIQUE INDEX "pending_invites_invite_token_key" ON "pending_invites"("invite_token");

-- CreateIndex for TelegramRelinkToken unique constraint
CREATE UNIQUE INDEX "telegram_relink_tokens_token_key" ON "telegram_relink_tokens"("token");

-- AddForeignKey for PendingInvite
ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey for TelegramRelinkToken
ALTER TABLE "telegram_relink_tokens" ADD CONSTRAINT "telegram_relink_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telegram_relink_tokens" ADD CONSTRAINT "telegram_relink_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
