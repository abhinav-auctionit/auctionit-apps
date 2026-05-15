-- Denormalised current-bid state on each Lot. Updated atomically inside the
-- placeBid transaction so reads (leaderboards, room snapshots) don't have to
-- aggregate over the bids table on every request, and so concurrent bidders
-- can be serialised cheaply with a single FOR UPDATE on the lot row.

ALTER TABLE "lots"
  ADD COLUMN "current_bid_cents" INTEGER,
  ADD COLUMN "current_bidder_id" UUID,
  ADD COLUMN "current_bid_placed_at" TIMESTAMPTZ(6),
  ADD COLUMN "bid_count" INTEGER NOT NULL DEFAULT 0;
