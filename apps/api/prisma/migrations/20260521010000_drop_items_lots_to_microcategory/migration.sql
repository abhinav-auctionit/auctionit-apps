-- Remove the Item layer from inventory. Lots now reference Microcategory
-- directly, and the per-item attribute table becomes per-lot. Existing
-- auction/lot/bid/wallet state is test data and is wiped here so we can
-- restructure the lots table without backfill.

-- 1) Wipe dependent auction/lot/bid/wallet state. These tables have
--    cascading FKs onwards, so a single TRUNCATE per top-level table is
--    enough.
TRUNCATE TABLE
  "bids",
  "lot_participations",
  "auction_participations",
  "lots",
  "auctions",
  "wallet_transactions"
RESTART IDENTITY CASCADE;

-- Wallet rows survive (bidder profiles remain attached) but any EMD that
-- was locked against the now-deleted lots/auctions is no longer real.
UPDATE "bidder_wallets" SET "locked_balance" = 0;

-- 2) Detach lots from items, then drop the item layer. Lots own the FK
--    to items, so we drop it first; then item_attribute_values and items.
ALTER TABLE "lots" DROP CONSTRAINT "lots_item_id_fkey";
ALTER TABLE "lots" DROP COLUMN "item_id";

DROP TABLE "item_attribute_values";
DROP TABLE "items";

-- 3) Reshape lots: attach microcategory_id and move hsn/benchmark onto
--    the lot itself (uom was already on lots, so it stays).

ALTER TABLE "lots" ADD COLUMN "microcategory_id" UUID NOT NULL;
ALTER TABLE "lots" ADD COLUMN "hsn_code" VARCHAR(32) NOT NULL;
ALTER TABLE "lots" ADD COLUMN "benchmark_cents" INTEGER;

ALTER TABLE "lots"
  ADD CONSTRAINT "lots_microcategory_id_fkey"
  FOREIGN KEY ("microcategory_id") REFERENCES "microcategories"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "lots_microcategory_idx" ON "lots"("microcategory_id");

-- 4) Recreate the attribute-values table, now keyed on lot_id.
CREATE TABLE "lot_attribute_values" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "attribute_id" UUID,
    "custom_name" VARCHAR(255),
    "value_text" TEXT,
    "value_number" DECIMAL(14,4),
    "value_option_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lot_attribute_values_lot_id_attribute_id_unique"
  ON "lot_attribute_values"("lot_id", "attribute_id");

ALTER TABLE "lot_attribute_values"
  ADD CONSTRAINT "lot_attribute_values_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lot_attribute_values"
  ADD CONSTRAINT "lot_attribute_values_attribute_id_fkey"
  FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
