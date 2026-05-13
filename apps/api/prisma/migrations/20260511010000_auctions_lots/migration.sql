-- Refactor auctions into a client-owned container with separate Lot rows for
-- the actual biddable units. No production data yet, so we drop and recreate
-- rather than try to migrate the old auction columns in-place.

-- CreateEnum
CREATE TYPE "auction_type" AS ENUM ('forward', 'reverse', 'sealed_bid', 'yankee');

-- Drop the old bids + auctions tables (bids cascade via FK below).
DROP TABLE IF EXISTS "bids" CASCADE;
DROP TABLE IF EXISTS "auctions" CASCADE;

-- CreateTable
CREATE TABLE "auctions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "auction_type" "auction_type" NOT NULL,
    "status" "auction_status" NOT NULL DEFAULT 'draft',
    "emd_amount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auctions_code_key" ON "auctions"("code");

-- CreateIndex
CREATE INDEX "auctions_client_idx" ON "auctions"("client_id");

-- CreateIndex
CREATE INDEX "auctions_status_idx" ON "auctions"("status");

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "lot_no" INTEGER NOT NULL,
    "item_id" UUID,
    "item_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "qty" DECIMAL(14,4) NOT NULL,
    "uom" "uom" NOT NULL,
    "auction_date" DATE NOT NULL,
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "starting_price_cents" INTEGER NOT NULL,
    "bid_increment_cents" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lots_auction_lot_no_unique" ON "lots"("auction_id", "lot_no");

-- CreateIndex
CREATE INDEX "lots_auction_idx" ON "lots"("auction_id");

-- CreateIndex
CREATE INDEX "lots_start_time_idx" ON "lots"("start_time");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_auction_id_fkey"
    FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable (recreate bids, now referencing lots)
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "bidder_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bids_lot_idx" ON "bids"("lot_id", "placed_at" DESC);

-- CreateIndex
CREATE INDEX "bids_bidder_idx" ON "bids"("bidder_id");

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_fkey"
    FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
