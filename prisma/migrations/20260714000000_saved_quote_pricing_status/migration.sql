CREATE TYPE "QuotePricingStatus" AS ENUM ('CALCULATED', 'CONSULTATION_REQUIRED');

ALTER TABLE "SavedQuote"
ADD COLUMN "pricingStatus" "QuotePricingStatus" NOT NULL DEFAULT 'CALCULATED';

CREATE INDEX "SavedQuote_pricingStatus_idx" ON "SavedQuote"("pricingStatus");
