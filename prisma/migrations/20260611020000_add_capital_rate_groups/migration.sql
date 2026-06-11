-- Add explicit groups for identical capital-rate values.
-- Existing CapitalRateSheet values are untouched; backfill only writes groupId.

CREATE TABLE "CapitalRateGroup" (
    "id" TEXT NOT NULL,
    "financeCompanyId" TEXT NOT NULL,
    "productType" TEXT NOT NULL DEFAULT '장기렌트',
    "fingerprint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalRateGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CapitalRateSheet" ADD COLUMN "groupId" TEXT;

CREATE UNIQUE INDEX "CapitalRateGroup_fingerprint_key" ON "CapitalRateGroup"("fingerprint");
CREATE INDEX "CapitalRateGroup_financeCompanyId_productType_idx" ON "CapitalRateGroup"("financeCompanyId", "productType");
CREATE INDEX "CapitalRateSheet_groupId_idx" ON "CapitalRateSheet"("groupId");

ALTER TABLE "CapitalRateGroup" ADD CONSTRAINT "CapitalRateGroup_financeCompanyId_fkey"
    FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CapitalRateSheet" ADD CONSTRAINT "CapitalRateSheet_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CapitalRateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
