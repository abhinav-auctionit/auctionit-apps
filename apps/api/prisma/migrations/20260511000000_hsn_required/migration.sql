-- Widen the HSN column and make it required. Backfill any legacy rows that
-- have NULL hsn_code with an empty string so the NOT NULL constraint can be
-- applied without losing data. The Zod layer enforces min(1) on new writes.
ALTER TABLE "items" ALTER COLUMN "hsn_code" TYPE VARCHAR(32);
UPDATE "items" SET "hsn_code" = '' WHERE "hsn_code" IS NULL;
ALTER TABLE "items" ALTER COLUMN "hsn_code" SET NOT NULL;
