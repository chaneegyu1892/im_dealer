ALTER TABLE "ScrapeJob"
ADD COLUMN "leaseToken" TEXT;

CREATE UNIQUE INDEX "ScrapeJob_leaseToken_key"
ON "ScrapeJob"("leaseToken");
