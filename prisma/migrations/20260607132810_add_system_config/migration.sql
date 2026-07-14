-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "late_threshold_morning_hour" SMALLINT NOT NULL DEFAULT 8,
    "late_threshold_morning_min" SMALLINT NOT NULL DEFAULT 15,
    "late_threshold_afternoon_hour" SMALLINT NOT NULL DEFAULT 13,
    "late_threshold_afternoon_min" SMALLINT NOT NULL DEFAULT 15,
    "auto_checkout_hour" SMALLINT NOT NULL DEFAULT 16,
    "auto_checkout_min" SMALLINT NOT NULL DEFAULT 30,
    "cover_ttl_hours" SMALLINT NOT NULL DEFAULT 48,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
