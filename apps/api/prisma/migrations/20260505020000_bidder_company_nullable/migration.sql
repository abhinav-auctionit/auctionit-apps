-- Make company-step fields nullable so a draft profile can be created at registration
-- and filled progressively during the wizard. The submit endpoint enforces required-ness.

ALTER TABLE "bidder_profiles"
    ALTER COLUMN "company_name" DROP NOT NULL,
    ALTER COLUMN "company_type" DROP NOT NULL,
    ALTER COLUMN "business_activity" DROP NOT NULL,
    ALTER COLUMN "address" DROP NOT NULL,
    ALTER COLUMN "country" DROP NOT NULL,
    ALTER COLUMN "state" DROP NOT NULL,
    ALTER COLUMN "city" DROP NOT NULL,
    ALTER COLUMN "pin_code" DROP NOT NULL,
    ALTER COLUMN "designation" DROP NOT NULL,
    ALTER COLUMN "registered_email" DROP NOT NULL,
    ALTER COLUMN "gst" DROP NOT NULL,
    ALTER COLUMN "pan" DROP NOT NULL;
