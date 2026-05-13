-- AlterTable
ALTER TABLE "auctions" ADD COLUMN "location_id" UUID;

-- CreateIndex
CREATE INDEX "auctions_location_idx" ON "auctions"("location_id");

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "client_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
