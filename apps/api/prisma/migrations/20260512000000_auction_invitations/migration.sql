-- CreateEnum
CREATE TYPE "invitation_notification_status" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "auction_invitations" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "bidder_profile_id" UUID NOT NULL,
    "invited_by_id" UUID,
    "invited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notification_status" "invitation_notification_status" NOT NULL DEFAULT 'pending',
    "notification_sent_at" TIMESTAMPTZ(6),
    "notification_error" TEXT,

    CONSTRAINT "auction_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_auction_bidder_unique" ON "auction_invitations"("auction_id", "bidder_profile_id");

-- CreateIndex
CREATE INDEX "invitations_auction_idx" ON "auction_invitations"("auction_id");

-- CreateIndex
CREATE INDEX "invitations_bidder_idx" ON "auction_invitations"("bidder_profile_id");

-- AddForeignKey
ALTER TABLE "auction_invitations" ADD CONSTRAINT "auction_invitations_auction_id_fkey"
    FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_invitations" ADD CONSTRAINT "auction_invitations_bidder_profile_id_fkey"
    FOREIGN KEY ("bidder_profile_id") REFERENCES "bidder_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_invitations" ADD CONSTRAINT "auction_invitations_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
