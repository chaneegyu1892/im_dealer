-- CreateTable
CREATE TABLE "CustomerVerification" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerType" TEXT NOT NULL,
    "connectedId" TEXT,
    "licenseVerified" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "bizVerified" BOOLEAN NOT NULL DEFAULT false,
    "licenseData" JSONB,
    "insuranceData" JSONB,
    "bizData" JSONB,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerVerification_sessionId_idx" ON "CustomerVerification"("sessionId");
