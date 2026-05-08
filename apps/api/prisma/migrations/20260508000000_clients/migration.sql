-- CreateEnum
CREATE TYPE "other_charge_type" AS ENUM ('flat', 'percentage');

-- CreateEnum
CREATE TYPE "staggering_of_lots" AS ENUM ('none', 'all_lots', 'subsequent_lots');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "company_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "website_url" VARCHAR(100),
    "registered_address" VARCHAR(500) NOT NULL,
    "country" VARCHAR(64) NOT NULL,
    "pan" VARCHAR(10) NOT NULL,
    "tan" VARCHAR(10) NOT NULL,
    "tin" VARCHAR(15) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "prefix_auction_code" VARCHAR(25),
    "suffix_auction_code" VARCHAR(25),
    "auto_extend" BOOLEAN NOT NULL DEFAULT false,
    "extend_if_last_bid_sec" INTEGER,
    "extend_duration_sec" INTEGER,
    "extension_max_times" INTEGER,
    "staggering_of_lots" "staggering_of_lots",
    "staggering_of_lots_duration_sec" INTEGER,
    "staggering_of_auction" BOOLEAN,
    "staggering_of_auction_duration_sec" INTEGER,
    "other_charge_type" "other_charge_type",
    "other_charge_amount" INTEGER,
    "revenue_rate" INTEGER NOT NULL,
    "plant_tech_person_details" VARCHAR(200),
    "display_material_location" BOOLEAN NOT NULL DEFAULT false,
    "display_plant_location" BOOLEAN NOT NULL DEFAULT false,
    "tnc_file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_pan_unique" ON "clients"("pan");

-- CreateIndex
CREATE INDEX "clients_is_active_idx" ON "clients"("is_active");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tnc_file_id_fkey"
    FOREIGN KEY ("tnc_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
