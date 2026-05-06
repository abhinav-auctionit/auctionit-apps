-- CreateEnum
CREATE TYPE "interested_in" AS ENUM ('forward', 'reverse', 'both');

-- CreateEnum
CREATE TYPE "company_type" AS ENUM (
    'llp',
    'llc',
    'individual',
    'limited',
    'partnership',
    'pvt_limited',
    'sole_proprietorship'
);

-- CreateEnum
CREATE TYPE "business_activity" AS ENUM ('broker', 'end_user', 'trader', 'other');

-- CreateEnum
CREATE TYPE "subscription_type" AS ENUM ('annual', 'lifetime');

-- CreateEnum
CREATE TYPE "bidder_status" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "otp_channel" AS ENUM ('mobile', 'email');

-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "mobile_country_code" VARCHAR(8),
    ADD COLUMN "mobile_number" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_unique" ON "users"("mobile_country_code", "mobile_number");

-- CreateTable
CREATE TABLE "bidder_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "interested_in" "interested_in" NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "contact_country_code" VARCHAR(8) NOT NULL,
    "contact_number" VARCHAR(20) NOT NULL,
    "whatsapp_country_code" VARCHAR(8) NOT NULL,
    "whatsapp_number" VARCHAR(20) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "company_type" "company_type" NOT NULL,
    "business_activity" "business_activity" NOT NULL,
    "address" TEXT NOT NULL,
    "country" VARCHAR(64) NOT NULL,
    "state" VARCHAR(128) NOT NULL,
    "city" VARCHAR(128) NOT NULL,
    "pin_code" VARCHAR(16) NOT NULL,
    "designation" VARCHAR(128) NOT NULL,
    "secondary_number" VARCHAR(32),
    "registered_email" VARCHAR(255) NOT NULL,
    "gst" VARCHAR(32) NOT NULL,
    "pan" VARCHAR(16) NOT NULL,
    "pan_card_file_id" UUID,
    "proof_of_address_file_id" UUID,
    "cancelled_cheque_file_id" UUID,
    "other_file_id" UUID,
    "bank_account_number" VARCHAR(64),
    "bank_name" VARCHAR(255),
    "ifsc_code" VARCHAR(16),
    "terms_accepted_at" TIMESTAMPTZ(6),
    "signatory_name" VARCHAR(255),
    "signatory_designation" VARCHAR(128),
    "signatory_place" VARCHAR(128),
    "signatory_date" DATE,
    "subscription_type" "subscription_type",
    "registration_fee_paid" BOOLEAN NOT NULL DEFAULT false,
    "registration_fee_paid_at" TIMESTAMPTZ(6),
    "registration_fee_note" TEXT,
    "status" "bidder_status" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bidder_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bidder_profiles_user_id_key" ON "bidder_profiles"("user_id");

-- CreateIndex
CREATE INDEX "bidder_profiles_status_idx" ON "bidder_profiles"("status");

-- AddForeignKey
ALTER TABLE "bidder_profiles" ADD CONSTRAINT "bidder_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_profiles" ADD CONSTRAINT "bidder_profiles_pan_card_file_id_fkey"
    FOREIGN KEY ("pan_card_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_profiles" ADD CONSTRAINT "bidder_profiles_proof_of_address_file_id_fkey"
    FOREIGN KEY ("proof_of_address_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_profiles" ADD CONSTRAINT "bidder_profiles_cancelled_cheque_file_id_fkey"
    FOREIGN KEY ("cancelled_cheque_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_profiles" ADD CONSTRAINT "bidder_profiles_other_file_id_fkey"
    FOREIGN KEY ("other_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "channel" "otp_channel" NOT NULL,
    "target" VARCHAR(255) NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "purpose" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_challenges_target_idx" ON "otp_challenges"("channel", "target");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_idx" ON "otp_challenges"("expires_at");
