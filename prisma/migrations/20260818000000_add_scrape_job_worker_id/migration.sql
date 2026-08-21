ALTER TABLE "ScrapeJob"
ADD COLUMN "workerId" TEXT;

CREATE INDEX "ScrapeJob_status_workerId_idx"
ON "ScrapeJob"("status", "workerId");
