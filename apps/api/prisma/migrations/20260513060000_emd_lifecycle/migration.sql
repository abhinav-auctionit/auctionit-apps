-- EMD lifecycle + admin-driven bidder attachment.
-- This migration:
--   * Replaces the invitation/join flow with admin attach (AuctionInvitation dropped).
--   * Adds locked_balance to wallets so EMD can be held without leaving the wallet.
--   * Replaces emd_debit/emd_refund with emd_hold/emd_release in wallet_txn_kind.
--   * Renames auctions.emd_amount → consolidated_emd_amount (nullable).
--   * Adds lots.emd_amount (required) and lot outcome columns.
--   * Adds lot_participations and auction_participations.
--
-- Dev data is wiped (no production EMD flow yet).

-- 1. Drop the entire invitations table + the enum it depends on.
DROP TABLE IF EXISTS "auction_invitations" CASCADE;
DROP TYPE IF EXISTS "invitation_notification_status";

-- 2. Wipe old EMD wallet transactions; the legacy "emd_debit" flow had no hold/release
--    semantics so the rows are not meaningful under the new model.
DELETE FROM "wallet_transactions" WHERE "kind" IN ('emd_debit', 'emd_refund');

-- 3. Recreate wallet_txn_kind with the new values. Postgres has no
--    ALTER TYPE … DROP VALUE; cast to text, drop, recreate, cast back.
ALTER TABLE "wallet_transactions" ALTER COLUMN "kind" TYPE text USING "kind"::text;
DROP TYPE "wallet_txn_kind";
CREATE TYPE "wallet_txn_kind" AS ENUM (
  'admin_credit',
  'admin_debit_correction',
  'emd_hold',
  'emd_release',
  'emd_forfeit'
);
ALTER TABLE "wallet_transactions"
  ALTER COLUMN "kind" TYPE "wallet_txn_kind" USING "kind"::"wallet_txn_kind";

-- 4. Wallet locked balance. Reset all wallets to lockedBalance = 0 because we've
--    wiped the legacy holds in step 2.
ALTER TABLE "bidder_wallets" ADD COLUMN "locked_balance" INTEGER NOT NULL DEFAULT 0;

-- 5. Rename auctions.emd_amount → consolidated_emd_amount; make nullable.
ALTER TABLE "auctions" RENAME COLUMN "emd_amount" TO "consolidated_emd_amount";
ALTER TABLE "auctions" ALTER COLUMN "consolidated_emd_amount" DROP DEFAULT;
ALTER TABLE "auctions" ALTER COLUMN "consolidated_emd_amount" DROP NOT NULL;
-- Existing rows had 0 (default); 0 in the new model means "lot-level only mode with
-- consolidated unset." Convert to NULL for clarity.
UPDATE "auctions" SET "consolidated_emd_amount" = NULL WHERE "consolidated_emd_amount" = 0;

-- 6. Lot outcome columns + per-lot EMD. emd_amount defaults to 0 during the migration
--    so existing rows pass NOT NULL, then we drop the default so new lots must supply
--    a value via DTO.
CREATE TYPE "lot_outcome_status" AS ENUM (
  'pending_lift',
  'lifted',
  'forfeited',
  'rejected_by_client',
  'no_winner'
);

ALTER TABLE "lots" ADD COLUMN "emd_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lots" ALTER COLUMN "emd_amount" DROP DEFAULT;
ALTER TABLE "lots" ADD COLUMN "winner_id" UUID;
ALTER TABLE "lots" ADD COLUMN "winning_bid_amount_cents" INTEGER;
ALTER TABLE "lots" ADD COLUMN "outcome_status" "lot_outcome_status";
ALTER TABLE "lots" ADD COLUMN "lifted_at" TIMESTAMPTZ(6);
ALTER TABLE "lots" ADD COLUMN "forfeited_at" TIMESTAMPTZ(6);
ALTER TABLE "lots" ADD COLUMN "rejected_at" TIMESTAMPTZ(6);

ALTER TABLE "lots" ADD CONSTRAINT "lots_winner_id_fkey"
  FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. lot_participations + auction_participations.
CREATE TABLE "lot_participations" (
  "id" UUID NOT NULL,
  "lot_id" UUID NOT NULL,
  "bidder_profile_id" UUID NOT NULL,
  "emd_held_amount" INTEGER NOT NULL,
  "attached_by_id" UUID,
  "attached_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMPTZ(6),
  "hold_txn_id" UUID,
  "release_txn_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lot_participations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lot_participations_lot_bidder_unique"
  ON "lot_participations"("lot_id", "bidder_profile_id");
CREATE INDEX "lot_participations_bidder_idx" ON "lot_participations"("bidder_profile_id");

ALTER TABLE "lot_participations" ADD CONSTRAINT "lot_participations_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_participations" ADD CONSTRAINT "lot_participations_bidder_profile_id_fkey"
  FOREIGN KEY ("bidder_profile_id") REFERENCES "bidder_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_participations" ADD CONSTRAINT "lot_participations_attached_by_id_fkey"
  FOREIGN KEY ("attached_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "auction_participations" (
  "id" UUID NOT NULL,
  "auction_id" UUID NOT NULL,
  "bidder_profile_id" UUID NOT NULL,
  "consolidated_emd_held_amount" INTEGER NOT NULL,
  "attached_by_id" UUID,
  "attached_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMPTZ(6),
  "settlement_refund_amount" INTEGER,
  "settlement_forfeit_amount" INTEGER,
  "settlement_shortfall_amount" INTEGER NOT NULL DEFAULT 0,
  "hold_txn_id" UUID,
  "settle_refund_txn_id" UUID,
  "settle_forfeit_txn_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auction_participations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auction_participations_auction_bidder_unique"
  ON "auction_participations"("auction_id", "bidder_profile_id");
CREATE INDEX "auction_participations_bidder_idx" ON "auction_participations"("bidder_profile_id");

ALTER TABLE "auction_participations" ADD CONSTRAINT "auction_participations_auction_id_fkey"
  FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auction_participations" ADD CONSTRAINT "auction_participations_bidder_profile_id_fkey"
  FOREIGN KEY ("bidder_profile_id") REFERENCES "bidder_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auction_participations" ADD CONSTRAINT "auction_participations_attached_by_id_fkey"
  FOREIGN KEY ("attached_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
