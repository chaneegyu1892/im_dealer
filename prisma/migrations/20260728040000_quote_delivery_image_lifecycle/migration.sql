-- Bound public quote-delivery PNGs to a finite retention window and retain
-- observable, retryable cleanup state separately from delivery status.
ALTER TABLE "QuoteDelivery"
  ADD COLUMN IF NOT EXISTS "imageDeletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "imageCleanupAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "imageCleanupLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "imageCleanupError" TEXT;

CREATE INDEX IF NOT EXISTS "QuoteDelivery_imageDeletedAt_createdAt_idx"
  ON "QuoteDelivery"("imageDeletedAt", "createdAt");
