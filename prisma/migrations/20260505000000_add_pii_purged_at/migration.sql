-- AlterTable
ALTER TABLE "CustomerVerification" ADD COLUMN "piiPurgedAt" TIMESTAMP(3);

-- CreateIndex (만료 cron 의 WHERE 절 가속)
CREATE INDEX "CustomerVerification_verifiedAt_piiPurgedAt_idx" ON "CustomerVerification"("verifiedAt", "piiPurgedAt");
