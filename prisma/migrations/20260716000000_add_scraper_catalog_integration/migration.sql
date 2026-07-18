ALTER TABLE "Vehicle"
ADD COLUMN "scraperRefs" JSONB;

CREATE TABLE "ScrapeJob" (
  "id" TEXT NOT NULL,
  "financeCompanyId" TEXT NOT NULL,
  "jobType" TEXT NOT NULL DEFAULT 'trim_rates',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "productType" TEXT NOT NULL DEFAULT '장기렌트',
  "params" JSONB NOT NULL,
  "credUsernameEnc" TEXT,
  "credPasswordEnc" TEXT,
  "draft" JSONB,
  "progress" JSONB,
  "error" TEXT,
  "humanPrompt" TEXT,
  "claimedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapitalCatalogTrim" (
  "id" TEXT NOT NULL,
  "financeCompanyId" TEXT NOT NULL,
  "productType" TEXT NOT NULL DEFAULT '장기렌트',
  "brandCd" TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "modelCd" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "dtMdlCd" TEXT NOT NULL,
  "dtMdlName" TEXT,
  "mdelCd" TEXT NOT NULL,
  "trimName" TEXT NOT NULL,
  "modelYear" TEXT,
  "vehiclePrice" INTEGER NOT NULL,
  "baseRates" JSONB NOT NULL,
  "depositRate36_10000" INTEGER,
  "prepayRate36_10000" INTEGER,
  "warnings" JSONB,
  "weekOf" TIMESTAMP(3) NOT NULL,
  "scrapedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CapitalCatalogTrim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CapitalTrimMapping" (
  "id" TEXT NOT NULL,
  "financeCompanyId" TEXT NOT NULL,
  "trimId" TEXT NOT NULL,
  "productType" TEXT NOT NULL DEFAULT '장기렌트',
  "catalogTrimId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "confidence" TEXT,
  "externalMdelCd" TEXT NOT NULL,
  "externalLabel" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CapitalTrimMapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScrapeJob_status_createdAt_idx"
ON "ScrapeJob"("status", "createdAt");

CREATE INDEX "ScrapeJob_financeCompanyId_status_idx"
ON "ScrapeJob"("financeCompanyId", "status");

CREATE UNIQUE INDEX "CapitalCatalogTrim_financeCompanyId_productType_mdelCd_key"
ON "CapitalCatalogTrim"("financeCompanyId", "productType", "mdelCd");

CREATE INDEX "CapitalCatalogTrim_financeCompanyId_brandCd_idx"
ON "CapitalCatalogTrim"("financeCompanyId", "brandCd");

CREATE INDEX "CapitalCatalogTrim_financeCompanyId_weekOf_idx"
ON "CapitalCatalogTrim"("financeCompanyId", "weekOf");

CREATE UNIQUE INDEX "CapitalTrimMapping_financeCompanyId_trimId_productType_key"
ON "CapitalTrimMapping"("financeCompanyId", "trimId", "productType");

CREATE INDEX "CapitalTrimMapping_catalogTrimId_idx"
ON "CapitalTrimMapping"("catalogTrimId");

ALTER TABLE "ScrapeJob"
ADD CONSTRAINT "ScrapeJob_financeCompanyId_fkey"
FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CapitalCatalogTrim"
ADD CONSTRAINT "CapitalCatalogTrim_financeCompanyId_fkey"
FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CapitalTrimMapping"
ADD CONSTRAINT "CapitalTrimMapping_financeCompanyId_fkey"
FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CapitalTrimMapping"
ADD CONSTRAINT "CapitalTrimMapping_trimId_fkey"
FOREIGN KEY ("trimId") REFERENCES "Trim"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CapitalTrimMapping"
ADD CONSTRAINT "CapitalTrimMapping_catalogTrimId_fkey"
FOREIGN KEY ("catalogTrimId") REFERENCES "CapitalCatalogTrim"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
