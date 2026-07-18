BEGIN;

DO $brand$
BEGIN
  IF to_regclass('public."Brand"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."Brand" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "logoUrl" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "Brand_name_key"
      ON public."Brand"("name");
  END IF;
END
$brand$;

COMMIT;
