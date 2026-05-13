-- CreateEnum
CREATE TYPE "engagement_purpose" AS ENUM (
  'auction_follow_up',
  'auction_debrief',
  'complaint_escalation',
  'invoice_query',
  'general_check_in',
  'other'
);

-- CreateEnum
CREATE TYPE "engagement_medium" AS ENUM (
  'phone_call',
  'email',
  'in_person',
  'video_call',
  'whatsapp',
  'other'
);

-- CreateTable
CREATE TABLE "client_engagements" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "happened_at" TIMESTAMPTZ(6) NOT NULL,
    "person_name" VARCHAR(120) NOT NULL,
    "person_role" VARCHAR(120),
    "purpose" "engagement_purpose" NOT NULL,
    "medium" "engagement_medium" NOT NULL,
    "comments" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_engagements_client_happened_idx"
    ON "client_engagements"("client_id", "happened_at" DESC);

-- AddForeignKey
ALTER TABLE "client_engagements" ADD CONSTRAINT "client_engagements_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_engagements" ADD CONSTRAINT "client_engagements_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
