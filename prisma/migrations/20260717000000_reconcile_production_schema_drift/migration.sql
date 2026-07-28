-- Reconcile known production-only objects while keeping this migration safe for fresh databases.

BEGIN;

CREATE TABLE IF NOT EXISTS public."quota_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "computed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "total_bytes" BIGINT NOT NULL,
  "attachment_count" INTEGER NOT NULL,
  CONSTRAINT "quota_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quota_log_computed_at_idx"
  ON public."quota_log" ("computed_at" DESC);

DO $quota_log_checks$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS existing_constraint
    WHERE existing_constraint.conrelid = 'public."quota_log"'::regclass
      AND existing_constraint.conname = 'quota_log_total_bytes_nonnegative_check'
  ) THEN
    ALTER TABLE public."quota_log"
      ADD CONSTRAINT "quota_log_total_bytes_nonnegative_check"
      CHECK ("total_bytes" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS existing_constraint
    WHERE existing_constraint.conrelid = 'public."quota_log"'::regclass
      AND existing_constraint.conname = 'quota_log_attachment_count_nonnegative_check'
  ) THEN
    ALTER TABLE public."quota_log"
      ADD CONSTRAINT "quota_log_attachment_count_nonnegative_check"
      CHECK ("attachment_count" >= 0);
  END IF;

  ALTER TABLE public."quota_log"
    VALIDATE CONSTRAINT "quota_log_total_bytes_nonnegative_check";
  ALTER TABLE public."quota_log"
    VALIDATE CONSTRAINT "quota_log_attachment_count_nonnegative_check";
END
$quota_log_checks$;

ALTER TABLE public."quota_log" ENABLE ROW LEVEL SECURITY;

DO $quota_log_policy$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policy.polname
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'public."quota_log"'::regclass
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY %I ON %I.%I',
      existing_policy.polname,
      'public',
      'quota_log'
    );
  END LOOP;

  CREATE POLICY "quota_log_select_authenticated"
    ON public."quota_log"
    FOR SELECT
    TO PUBLIC
    USING (auth.uid() IS NOT NULL);
END
$quota_log_policy$;

CREATE OR REPLACE FUNCTION public.record_quota_snapshot(
  p_total_bytes bigint,
  p_attachment_count integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF p_total_bytes IS NULL
     OR p_attachment_count IS NULL
     OR p_total_bytes < 0
     OR p_attachment_count < 0 THEN
    RAISE EXCEPTION 'record_quota_snapshot arguments must be non-NULL and nonnegative'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public."quota_log" ("total_bytes", "attachment_count")
  VALUES (p_total_bytes, p_attachment_count);
END;
$function$;

DO $record_quota_snapshot_acl$
DECLARE
  explicit_grantee RECORD;
  function_oid OID;
  function_owner_oid OID;
  service_role_oid OID;
BEGIN
  SELECT proc.oid, proc.proowner
  INTO STRICT function_oid, function_owner_oid
  FROM pg_catalog.pg_proc AS proc
  WHERE proc.oid = 'public.record_quota_snapshot(bigint, integer)'::regprocedure;

  SELECT role.oid
  INTO service_role_oid
  FROM pg_catalog.pg_roles AS role
  WHERE role.rolname = 'service_role';

  REVOKE EXECUTE ON FUNCTION public.record_quota_snapshot(bigint, integer)
    FROM PUBLIC CASCADE;

  FOR explicit_grantee IN
    SELECT DISTINCT role.rolname
    FROM pg_catalog.pg_proc AS proc
    CROSS JOIN LATERAL pg_catalog.aclexplode(proc.proacl) AS acl
    JOIN pg_catalog.pg_roles AS role ON role.oid = acl.grantee
    WHERE proc.oid = function_oid
      AND acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> 0
      AND acl.grantee <> function_owner_oid
      AND (service_role_oid IS NULL OR acl.grantee <> service_role_oid)
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(bigint, integer) FROM %I CASCADE',
      'public',
      'record_quota_snapshot',
      explicit_grantee.rolname
    );
  END LOOP;

  IF service_role_oid IS NOT NULL THEN
    EXECUTE pg_catalog.format(
      'REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION %I.%I(bigint, integer) FROM %I CASCADE',
      'public',
      'record_quota_snapshot',
      'service_role'
    );
    EXECUTE pg_catalog.format(
      'GRANT EXECUTE ON FUNCTION %I.%I(bigint, integer) TO %I',
      'public',
      'record_quota_snapshot',
      'service_role'
    );
  END IF;
END
$record_quota_snapshot_acl$;

-- Rollback note: restoring CustomerVerification.userId requires re-adding its nullable TEXT column, index, and intended FK.
DO $customer_verification_user_id$
DECLARE
  has_values BOOLEAN;
BEGIN
  IF to_regclass('public."CustomerVerification"') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'CustomerVerification'
         AND column_name = 'userId'
     ) THEN
    LOCK TABLE public."CustomerVerification" IN ACCESS EXCLUSIVE MODE;

    SELECT EXISTS (
      SELECT 1
      FROM public."CustomerVerification"
      WHERE "userId" IS NOT NULL
    ) INTO has_values;

    IF has_values THEN
      RAISE EXCEPTION 'CustomerVerification.userId contains non-NULL values; migrate or clear them before dropping the column';
    END IF;

    ALTER TABLE public."CustomerVerification"
      DROP CONSTRAINT IF EXISTS "CustomerVerification_userId_fkey";
    DROP INDEX IF EXISTS public."CustomerVerification_userId_idx";
    ALTER TABLE public."CustomerVerification" DROP COLUMN "userId";
  END IF;
END
$customer_verification_user_id$;

CREATE INDEX IF NOT EXISTS "CustomerVerification_verifiedAt_piiPurgedAt_idx"
  ON public."CustomerVerification"("verifiedAt", "piiPurgedAt");

-- Rollback note: remove these nullable columns only after confirming that no application data has been written to them.
ALTER TABLE public."Vehicle"
  ADD COLUMN IF NOT EXISTS "tags" TEXT[];
UPDATE public."Vehicle"
SET "tags" = ARRAY[]::TEXT[]
WHERE "tags" IS NULL;
ALTER TABLE public."Vehicle"
  ALTER COLUMN "tags" DROP DEFAULT,
  ALTER COLUMN "tags" SET NOT NULL;

ALTER TABLE IF EXISTS public."SavedQuote"
  ADD COLUMN IF NOT EXISTS "customerName" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationSessionId" TEXT;

ALTER TABLE public."Inventory"
  ADD COLUMN IF NOT EXISTS "selectedOptions" TEXT[];
UPDATE public."Inventory"
SET "selectedOptions" = ARRAY[]::TEXT[]
WHERE "selectedOptions" IS NULL;
ALTER TABLE public."Inventory"
  ALTER COLUMN "selectedOptions" DROP DEFAULT,
  ALTER COLUMN "selectedOptions" SET NOT NULL;

ALTER TABLE public."QuoteCalcLog"
  ADD COLUMN IF NOT EXISTS "optionIds" TEXT[];
UPDATE public."QuoteCalcLog"
SET "optionIds" = ARRAY[]::TEXT[]
WHERE "optionIds" IS NULL;
ALTER TABLE public."QuoteCalcLog"
  ALTER COLUMN "optionIds" DROP DEFAULT,
  ALTER COLUMN "optionIds" SET NOT NULL;

DO $saved_quote_updated_at_default$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SavedQuote'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE public."SavedQuote" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END
$saved_quote_updated_at_default$;

-- Rollback note: the nullable INTEGER column can be re-added, but its former values cannot be restored.
DO $vehicle_ev_subsidy$
BEGIN
  IF to_regclass('public."Vehicle"') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'Vehicle'
         AND column_name = 'evSubsidy'
     ) THEN
    LOCK TABLE public."Vehicle" IN ACCESS EXCLUSIVE MODE;

    IF EXISTS (
      SELECT 1
      FROM public."Vehicle"
      WHERE "evSubsidy" IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Vehicle.evSubsidy contains non-NULL values; migrate or clear them before dropping the column';
    END IF;

    ALTER TABLE public."Vehicle" DROP COLUMN "evSubsidy";
  END IF;
END
$vehicle_ev_subsidy$;

DROP INDEX IF EXISTS public."AdminUser_email_key";

DROP INDEX IF EXISTS public."SavedQuote_sessionId_idx";

COMMIT;
