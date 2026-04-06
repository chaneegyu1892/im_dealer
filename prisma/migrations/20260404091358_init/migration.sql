-- CreateTable
CREATE TABLE "FinanceCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "surchargeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateConfig" (
    "id" TEXT NOT NULL,
    "financeCompanyId" TEXT NOT NULL,
    "vehicleCode" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "minVehiclePrice" INTEGER NOT NULL,
    "maxVehiclePrice" INTEGER NOT NULL,
    "minPriceRates" JSONB NOT NULL,
    "maxPriceRates" JSONB NOT NULL,
    "depositDiscountRate" DOUBLE PRECISION NOT NULL,
    "prepayAdjustRate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSurchargeConfig" (
    "id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RankSurchargeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "vehicleCode" TEXT,
    "basePrice" INTEGER NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "surchargeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trim" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "engineType" TEXT NOT NULL,
    "fuelEfficiency" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "specs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrimOption" (
    "id" TEXT NOT NULL,
    "trimId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrimOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVariable" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "trimId" TEXT,
    "contractMonths" INTEGER[],
    "annualMileages" INTEGER[],
    "interestRate" DOUBLE PRECISION NOT NULL,
    "residualRate" DOUBLE PRECISION NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "miscCost" INTEGER NOT NULL DEFAULT 0,
    "depositOptions" INTEGER[],
    "prepayOptions" INTEGER[],
    "promoDiscount" INTEGER NOT NULL DEFAULT 0,
    "promoNote" TEXT,
    "promoExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "QuoteVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedQuote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "trimId" TEXT NOT NULL,
    "contractMonths" INTEGER NOT NULL,
    "annualMileage" INTEGER NOT NULL,
    "depositRate" INTEGER NOT NULL,
    "prepayRate" INTEGER NOT NULL,
    "contractType" TEXT NOT NULL,
    "monthlyPayment" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "budgetMin" INTEGER NOT NULL,
    "budgetMax" INTEGER NOT NULL,
    "paymentStyle" TEXT NOT NULL,
    "annualMileage" INTEGER NOT NULL,
    "returnType" TEXT NOT NULL,
    "recommendedVehicleIds" TEXT[],
    "recommendedReason" JSONB NOT NULL,
    "clickedVehicleId" TEXT,
    "clickedAt" TIMESTAMP(3),
    "proceedToQuote" BOOLEAN NOT NULL DEFAULT false,
    "vehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "RecommendationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplorationLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "path" TEXT,
    "vehicleId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "ExplorationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationConfig" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "scoreMatrix" JSONB NOT NULL,
    "highlights" TEXT[],
    "aiCaption" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "RecommendationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBanner" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalNote" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCompany_name_key" ON "FinanceCompany"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCompany_code_key" ON "FinanceCompany"("code");

-- CreateIndex
CREATE INDEX "RateConfig_vehicleCode_idx" ON "RateConfig"("vehicleCode");

-- CreateIndex
CREATE UNIQUE INDEX "RateConfig_financeCompanyId_vehicleCode_productType_key" ON "RateConfig"("financeCompanyId", "vehicleCode", "productType");

-- CreateIndex
CREATE UNIQUE INDEX "RankSurchargeConfig_rank_key" ON "RankSurchargeConfig"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_slug_key" ON "Vehicle"("slug");

-- CreateIndex
CREATE INDEX "Vehicle_isVisible_isPopular_idx" ON "Vehicle"("isVisible", "isPopular");

-- CreateIndex
CREATE INDEX "Vehicle_category_idx" ON "Vehicle"("category");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleCode_idx" ON "Vehicle"("vehicleCode");

-- CreateIndex
CREATE INDEX "Trim_vehicleId_idx" ON "Trim"("vehicleId");

-- CreateIndex
CREATE INDEX "TrimOption_trimId_idx" ON "TrimOption"("trimId");

-- CreateIndex
CREATE INDEX "QuoteVariable_vehicleId_trimId_idx" ON "QuoteVariable"("vehicleId", "trimId");

-- CreateIndex
CREATE INDEX "SavedQuote_sessionId_idx" ON "SavedQuote"("sessionId");

-- CreateIndex
CREATE INDEX "RecommendationLog_sessionId_idx" ON "RecommendationLog"("sessionId");

-- CreateIndex
CREATE INDEX "RecommendationLog_createdAt_idx" ON "RecommendationLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExplorationLog_sessionId_idx" ON "ExplorationLog"("sessionId");

-- CreateIndex
CREATE INDEX "ExplorationLog_eventType_createdAt_idx" ON "ExplorationLog"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationConfig_vehicleId_key" ON "RecommendationConfig"("vehicleId");

-- CreateIndex
CREATE INDEX "ContentBanner_type_isVisible_idx" ON "ContentBanner"("type", "isVisible");

-- CreateIndex
CREATE INDEX "OperationalNote_category_isPinned_idx" ON "OperationalNote"("category", "isPinned");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "RateConfig" ADD CONSTRAINT "RateConfig_financeCompanyId_fkey" FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trim" ADD CONSTRAINT "Trim_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrimOption" ADD CONSTRAINT "TrimOption_trimId_fkey" FOREIGN KEY ("trimId") REFERENCES "Trim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVariable" ADD CONSTRAINT "QuoteVariable_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVariable" ADD CONSTRAINT "QuoteVariable_trimId_fkey" FOREIGN KEY ("trimId") REFERENCES "Trim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationLog" ADD CONSTRAINT "RecommendationLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationLog" ADD CONSTRAINT "ExplorationLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationConfig" ADD CONSTRAINT "RecommendationConfig_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalNote" ADD CONSTRAINT "OperationalNote_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
