-- Add a client-level flag controlling whether the consolidated EMD option is
-- available for that client's auctions. Default off: clients opt in explicitly.
ALTER TABLE "clients" ADD COLUMN "allows_consolidated_emd" BOOLEAN NOT NULL DEFAULT false;
