-- Introduce a third taxonomy level (Microcategory) between Subcategory and
-- Item. Items now attach to a microcategory rather than directly to a
-- subcategory. All existing inventory + auction/lot/bid data is test data
-- and is wiped here so the new seed can populate the full business taxonomy.

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

-- 2) Wipe inventory tables in dependency order. Items have a NoAction FK
--    onto subcategories, so we have to remove items first.
TRUNCATE TABLE
  "item_attribute_values",
  "items",
  "subcategories",
  "categories"
RESTART IDENTITY CASCADE;

-- 3) CreateTable: microcategories
CREATE TABLE "microcategories" (
    "id" UUID NOT NULL,
    "subcategory_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microcategories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "microcategories_subcategory_id_name_unique"
  ON "microcategories"("subcategory_id", "name");

ALTER TABLE "microcategories"
  ADD CONSTRAINT "microcategories_subcategory_id_fkey"
  FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Re-point items at microcategories. Because we truncated above, the
--    items table is empty and we can swap the column without backfill.
ALTER TABLE "items" DROP CONSTRAINT "items_subcategory_id_subcategories_id_fk";
ALTER TABLE "items" DROP COLUMN "subcategory_id";
ALTER TABLE "items" ADD COLUMN "microcategory_id" UUID NOT NULL;

ALTER TABLE "items"
  ADD CONSTRAINT "items_microcategory_id_fkey"
  FOREIGN KEY ("microcategory_id") REFERENCES "microcategories"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;
