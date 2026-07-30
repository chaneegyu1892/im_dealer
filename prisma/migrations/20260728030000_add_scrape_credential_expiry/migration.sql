-- Bound automatic-login scraper credentials to a short-lived retention window.
-- Existing rows are backfilled from their creation time. The scheduled purge
-- clears only ciphertext; terminal audit rows themselves remain intact.
ALTER TABLE "ScrapeJob"
  ADD COLUMN "credentialExpiresAt" TIMESTAMP(3);

UPDATE "ScrapeJob"
SET "credentialExpiresAt" = "createdAt" + INTERVAL '24 hours'
WHERE "credentialExpiresAt" IS NULL;

CREATE INDEX "ScrapeJob_status_credentialExpiresAt_idx"
ON "ScrapeJob"("status", "credentialExpiresAt");
