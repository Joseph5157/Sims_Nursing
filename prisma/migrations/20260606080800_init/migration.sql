-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'faculty');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('morning', 'afternoon');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('scheduled', 'completed', 'absent', 'cover_pending', 'covered');

-- CreateEnum
CREATE TYPE "AttendanceInStatus" AS ENUM ('normal', 'late', 'absent');

-- CreateEnum
CREATE TYPE "AttendanceOutStatus" AS ENUM ('normal', 'auto');

-- CreateEnum
CREATE TYPE "CoverStatus" AS ENUM ('open', 'covered', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'hidden');

-- CreateEnum
CREATE TYPE "ViolationChangeType" AS ENUM ('created', 'edited', 'hidden', 'flagged', 'flag_resolved');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "role" "Role" NOT NULL,
    "department" VARCHAR(100),
    "designation" VARCHAR(100),
    "telegram_id" VARCHAR(50),
    "telegram_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "registration_number" VARCHAR(50) NOT NULL,
    "student_name" VARCHAR(150) NOT NULL,
    "course" VARCHAR(50) NOT NULL,
    "semester_or_year" VARCHAR(20) NOT NULL,
    "academic_year" VARCHAR(10) NOT NULL,
    "institution" VARCHAR(150) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'active',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_upload_log" (
    "id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "deactivated_count" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_upload_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_slots" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "duty_date" DATE NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'scheduled',
    "covered_by" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_attendance" (
    "id" TEXT NOT NULL,
    "duty_slot_id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "in_time" TIMESTAMP(3),
    "out_time" TIMESTAMP(3),
    "in_status" "AttendanceInStatus" NOT NULL DEFAULT 'absent',
    "out_status" "AttendanceOutStatus" NOT NULL DEFAULT 'auto',
    "auto_out" BOOLEAN NOT NULL DEFAULT false,
    "overridden_by" TEXT,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duty_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_types" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "default_fine" DECIMAL(8,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "duty_slot_id" TEXT NOT NULL,
    "violation_type_id" TEXT NOT NULL,
    "custom_violation" TEXT,
    "fine_amount" DECIMAL(8,2) NOT NULL,
    "is_warning_only" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_note" TEXT,
    "flag_resolved_by" TEXT,
    "flag_resolved_at" TIMESTAMP(3),
    "record_status" "RecordStatus" NOT NULL DEFAULT 'active',
    "photo_path" VARCHAR(500),
    "photo_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violation_audit_log" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "change_type" "ViolationChangeType" NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violation_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "target_id" TEXT,
    "target_type" VARCHAR(50),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_requests" (
    "id" TEXT NOT NULL,
    "duty_slot_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason" TEXT,
    "status" "CoverStatus" NOT NULL DEFAULT 'open',
    "volunteer_id" TEXT,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cover_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_config" (
    "id" TEXT NOT NULL,
    "config_month" SMALLINT NOT NULL,
    "config_year" SMALLINT NOT NULL,
    "blocked_dates" JSONB NOT NULL DEFAULT '[]',
    "working_days" JSONB NOT NULL DEFAULT '[]',
    "sessions_per_faculty" SMALLINT NOT NULL DEFAULT 3,
    "max_cover_requests_per_slot" SMALLINT NOT NULL DEFAULT 3,
    "is_window_open" BOOLEAN NOT NULL DEFAULT false,
    "opened_by" TEXT,
    "opened_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "deleted_by_sender" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_receiver" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_access_log" (
    "id" TEXT NOT NULL,
    "violation_id" TEXT NOT NULL,
    "accessed_by" TEXT NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "otp_sessions_user_id_expires_at_idx" ON "otp_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "students_registration_number_key" ON "students"("registration_number");

-- CreateIndex
CREATE INDEX "duty_slots_faculty_id_duty_date_idx" ON "duty_slots"("faculty_id", "duty_date");

-- CreateIndex
CREATE UNIQUE INDEX "duty_attendance_duty_slot_id_key" ON "duty_attendance"("duty_slot_id");

-- CreateIndex
CREATE INDEX "duty_attendance_duty_slot_id_idx" ON "duty_attendance"("duty_slot_id");

-- CreateIndex
CREATE INDEX "violations_student_id_idx" ON "violations"("student_id");

-- CreateIndex
CREATE INDEX "violations_faculty_id_idx" ON "violations"("faculty_id");

-- CreateIndex
CREATE INDEX "violations_duty_slot_id_idx" ON "violations"("duty_slot_id");

-- CreateIndex
CREATE INDEX "violations_is_flagged_idx" ON "violations"("is_flagged");

-- CreateIndex
CREATE INDEX "cover_requests_status_expires_at_idx" ON "cover_requests"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_config_config_month_config_year_key" ON "calendar_config"("config_month", "config_year");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_sessions" ADD CONSTRAINT "otp_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_upload_log" ADD CONSTRAINT "student_upload_log_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_slots" ADD CONSTRAINT "duty_slots_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_slots" ADD CONSTRAINT "duty_slots_covered_by_fkey" FOREIGN KEY ("covered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_slots" ADD CONSTRAINT "duty_slots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_attendance" ADD CONSTRAINT "duty_attendance_duty_slot_id_fkey" FOREIGN KEY ("duty_slot_id") REFERENCES "duty_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_attendance" ADD CONSTRAINT "duty_attendance_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_attendance" ADD CONSTRAINT "duty_attendance_overridden_by_fkey" FOREIGN KEY ("overridden_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_types" ADD CONSTRAINT "violation_types_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_duty_slot_id_fkey" FOREIGN KEY ("duty_slot_id") REFERENCES "duty_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_violation_type_id_fkey" FOREIGN KEY ("violation_type_id") REFERENCES "violation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_flag_resolved_by_fkey" FOREIGN KEY ("flag_resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_audit_log" ADD CONSTRAINT "violation_audit_log_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_audit_log" ADD CONSTRAINT "violation_audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_requests" ADD CONSTRAINT "cover_requests_duty_slot_id_fkey" FOREIGN KEY ("duty_slot_id") REFERENCES "duty_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_requests" ADD CONSTRAINT "cover_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_requests" ADD CONSTRAINT "cover_requests_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_requests" ADD CONSTRAINT "cover_requests_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_config" ADD CONSTRAINT "calendar_config_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_access_log" ADD CONSTRAINT "photo_access_log_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_access_log" ADD CONSTRAINT "photo_access_log_accessed_by_fkey" FOREIGN KEY ("accessed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
