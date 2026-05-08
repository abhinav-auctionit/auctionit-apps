-- CreateEnum
CREATE TYPE "wallet_txn_kind" AS ENUM (
    'admin_credit',
    'admin_debit_correction',
    'emd_debit',
    'emd_refund',
    'emd_forfeit'
);

-- AlterTable
ALTER TABLE "auctions" ADD COLUMN "emd_amount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "bidder_wallets" (
    "id" UUID NOT NULL,
    "bidder_profile_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bidder_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bidder_wallets_bidder_profile_id_key" ON "bidder_wallets"("bidder_profile_id");

-- AddForeignKey
ALTER TABLE "bidder_wallets" ADD CONSTRAINT "bidder_wallets_bidder_profile_id_fkey"
    FOREIGN KEY ("bidder_profile_id") REFERENCES "bidder_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "kind" "wallet_txn_kind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reference_type" VARCHAR(32),
    "reference_id" UUID,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_txn_wallet_idx" ON "wallet_transactions"("wallet_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey"
    FOREIGN KEY ("wallet_id") REFERENCES "bidder_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
