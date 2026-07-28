BEGIN;

DO $review$
BEGIN
  IF to_regclass('public."Review"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."Review" (
      "id" TEXT NOT NULL,
      "authorRealName" TEXT NOT NULL,
      "rating" INTEGER NOT NULL,
      "content" TEXT NOT NULL,
      "vehicleId" TEXT,
      "savedQuoteId" TEXT,
      "isPublic" BOOLEAN NOT NULL DEFAULT true,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Review_vehicleId_fkey"
        FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Review_savedQuoteId_fkey"
        FOREIGN KEY ("savedQuoteId") REFERENCES public."SavedQuote"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "Review_vehicleId_isPublic_displayOrder_idx"
      ON public."Review"("vehicleId", "isPublic", "displayOrder");
    CREATE INDEX IF NOT EXISTS "Review_isPublic_displayOrder_idx"
      ON public."Review"("isPublic", "displayOrder");
  END IF;
END
$review$;

COMMIT;
