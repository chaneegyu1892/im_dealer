BEGIN;

DO $rate_config$
DECLARE
  has_rows BOOLEAN;
BEGIN
  IF to_regclass('public."RateConfig"') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public."RateConfig" IN ACCESS EXCLUSIVE MODE';
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public."RateConfig")' INTO has_rows;

    IF has_rows THEN
      RAISE EXCEPTION 'Legacy RateConfig contains rows; an explicit data migration is required before applying the historical baseline';
    END IF;

    EXECUTE 'DROP TABLE IF EXISTS public."RateConfig"';
  END IF;
END
$rate_config$;

DO $legacy_user$
DECLARE
  has_rows BOOLEAN;
BEGIN
  IF to_regclass('public."AdminUser"') IS NOT NULL
     AND to_regclass('public."User"') IS NOT NULL THEN
    EXECUTE 'LOCK TABLE public."User" IN ACCESS EXCLUSIVE MODE';
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public."User")' INTO has_rows;

    IF has_rows THEN
      RAISE EXCEPTION 'Legacy User contains rows; an explicit data migration is required before AdminUser can be renamed';
    END IF;

    IF to_regclass('public."SavedQuote"') IS NOT NULL THEN
      ALTER TABLE public."SavedQuote"
        DROP CONSTRAINT IF EXISTS "SavedQuote_userId_fkey";
    END IF;

    IF to_regclass('public."CustomerVerification"') IS NOT NULL THEN
      ALTER TABLE public."CustomerVerification"
        DROP CONSTRAINT IF EXISTS "CustomerVerification_userId_fkey";
    END IF;

    DROP TABLE public."User" RESTRICT;
  END IF;
END
$legacy_user$;

DO $vehicle_lineup$
BEGIN
  IF to_regclass('public."VehicleLineup"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."VehicleLineup" (
      "id" TEXT NOT NULL,
      "vehicleId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "VehicleLineup_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "VehicleLineup_vehicleId_fkey"
        FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "VehicleLineup_vehicleId_idx"
      ON public."VehicleLineup"("vehicleId");

    ALTER TABLE public."Trim" ADD COLUMN IF NOT EXISTS "lineupId" TEXT;

    CREATE INDEX IF NOT EXISTS "Trim_lineupId_idx"
      ON public."Trim"("lineupId");

    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public."Trim"'::regclass
        AND conname = 'Trim_lineupId_fkey'
    ) THEN
      ALTER TABLE public."Trim"
        ADD CONSTRAINT "Trim_lineupId_fkey"
        FOREIGN KEY ("lineupId") REFERENCES public."VehicleLineup"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END
$vehicle_lineup$;

DO $option_rule$
BEGIN
  IF to_regclass('public."OptionRule"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."OptionRule" (
      "id" TEXT NOT NULL,
      "trimId" TEXT NOT NULL,
      "ruleType" TEXT NOT NULL,
      "sourceOptionId" TEXT NOT NULL,
      "targetOptionId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OptionRule_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "OptionRule_trimId_fkey"
        FOREIGN KEY ("trimId") REFERENCES public."Trim"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "OptionRule_sourceOptionId_fkey"
        FOREIGN KEY ("sourceOptionId") REFERENCES public."TrimOption"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "OptionRule_targetOptionId_fkey"
        FOREIGN KEY ("targetOptionId") REFERENCES public."TrimOption"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "OptionRule_trimId_idx"
      ON public."OptionRule"("trimId");
  END IF;
END
$option_rule$;

DO $capital_rate_sheet$
BEGIN
  IF to_regclass('public."CapitalRateSheet"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."CapitalRateSheet" (
      "id" TEXT NOT NULL,
      "financeCompanyId" TEXT NOT NULL,
      "trimId" TEXT NOT NULL,
      "weekOf" TIMESTAMP(3) NOT NULL,
      "minVehiclePrice" INTEGER NOT NULL,
      "maxVehiclePrice" INTEGER NOT NULL,
      "minBaseRates" JSONB NOT NULL,
      "minDepositRates" JSONB NOT NULL,
      "minPrepayRates" JSONB NOT NULL,
      "maxBaseRates" JSONB NOT NULL,
      "maxDepositRates" JSONB NOT NULL,
      "maxPrepayRates" JSONB NOT NULL,
      "minRateMatrix" JSONB NOT NULL,
      "maxRateMatrix" JSONB NOT NULL,
      "depositDiscountRate" DOUBLE PRECISION NOT NULL,
      "prepayAdjustRate" DOUBLE PRECISION NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "memo" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CapitalRateSheet_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "CapitalRateSheet_financeCompanyId_fkey"
        FOREIGN KEY ("financeCompanyId") REFERENCES public."FinanceCompany"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "CapitalRateSheet_trimId_fkey"
        FOREIGN KEY ("trimId") REFERENCES public."Trim"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "CapitalRateSheet_financeCompanyId_trimId_weekOf_key"
      ON public."CapitalRateSheet"("financeCompanyId", "trimId", "weekOf");
    CREATE INDEX IF NOT EXISTS "CapitalRateSheet_financeCompanyId_trimId_idx"
      ON public."CapitalRateSheet"("financeCompanyId", "trimId");
    CREATE INDEX IF NOT EXISTS "CapitalRateSheet_financeCompanyId_weekOf_idx"
      ON public."CapitalRateSheet"("financeCompanyId", "weekOf");
    CREATE INDEX IF NOT EXISTS "CapitalRateSheet_isActive_idx"
      ON public."CapitalRateSheet"("isActive");
  END IF;
END
$capital_rate_sheet$;

DO $inventory$
BEGIN
  IF to_regclass('public."Inventory"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."Inventory" (
      "id" TEXT NOT NULL,
      "trimId" TEXT NOT NULL,
      "stockCount" INTEGER NOT NULL DEFAULT 0,
      "location" TEXT,
      "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
      "colorExt" TEXT,
      "colorInt" TEXT,
      "vin" TEXT,
      "memo" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Inventory_trimId_fkey"
        FOREIGN KEY ("trimId") REFERENCES public."Trim"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "Inventory_vin_key"
      ON public."Inventory"("vin");
    CREATE INDEX IF NOT EXISTS "Inventory_trimId_idx"
      ON public."Inventory"("trimId");
  END IF;
END
$inventory$;

DO $quote_calc_log$
BEGIN
  IF to_regclass('public."QuoteCalcLog"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."QuoteCalcLog" (
      "id" TEXT NOT NULL,
      "sessionId" TEXT NOT NULL,
      "userId" TEXT,
      "vehicleId" TEXT NOT NULL,
      "vehicleSlug" TEXT NOT NULL,
      "trimId" TEXT,
      "optionIds" TEXT[],
      "contractMonths" INTEGER NOT NULL,
      "annualMileage" INTEGER NOT NULL,
      "depositRate" DOUBLE PRECISION NOT NULL,
      "prepayRate" DOUBLE PRECISION NOT NULL,
      "contractType" TEXT NOT NULL,
      "productType" TEXT NOT NULL,
      "resultMonthly" INTEGER NOT NULL,
      "bestFinanceCompany" TEXT NOT NULL,
      "scenarioType" TEXT NOT NULL,
      "clickedApply" BOOLEAN NOT NULL DEFAULT false,
      "deviceType" TEXT,
      "referrer" TEXT,
      "userAgent" TEXT,
      "ipHash" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuoteCalcLog_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "QuoteCalcLog_vehicleId_fkey"
        FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "QuoteCalcLog_vehicleSlug_createdAt_idx"
      ON public."QuoteCalcLog"("vehicleSlug", "createdAt");
    CREATE INDEX IF NOT EXISTS "QuoteCalcLog_sessionId_idx"
      ON public."QuoteCalcLog"("sessionId");
    CREATE INDEX IF NOT EXISTS "QuoteCalcLog_createdAt_idx"
      ON public."QuoteCalcLog"("createdAt");
    CREATE INDEX IF NOT EXISTS "QuoteCalcLog_scenarioType_createdAt_idx"
      ON public."QuoteCalcLog"("scenarioType", "createdAt");
  END IF;
END
$quote_calc_log$;

DO $admin_notification$
BEGIN
  IF to_regclass('public."AdminNotification"') IS NULL THEN
    CREATE TABLE IF NOT EXISTS public."AdminNotification" (
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "linkUrl" TEXT,
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX IF NOT EXISTS "AdminNotification_isRead_idx"
      ON public."AdminNotification"("isRead");
    CREATE INDEX IF NOT EXISTS "AdminNotification_createdAt_idx"
      ON public."AdminNotification"("createdAt");
  END IF;
END
$admin_notification$;

COMMIT;
