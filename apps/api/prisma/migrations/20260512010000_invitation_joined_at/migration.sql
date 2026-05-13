-- AlterTable: track when a bidder accepts an invitation by paying EMD.
ALTER TABLE "auction_invitations" ADD COLUMN "joined_at" TIMESTAMPTZ(6);
