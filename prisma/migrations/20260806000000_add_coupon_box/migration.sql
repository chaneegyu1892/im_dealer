-- 쿠폰함: 정책(CouponPolicy) + 발급본(IssuedCoupon)

DO $$ BEGIN
  CREATE TYPE "CouponTrigger" AS ENUM ('SIGNUP', 'FIRST_CONTRACT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CouponStatus" AS ENUM ('HELD', 'PENDING', 'PAID', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CouponPolicy" (
  "id"           TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "trigger"      "CouponTrigger" NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "rewardLabel"  TEXT NOT NULL,
  "rewardAmount" INTEGER,
  "rewardKind"   TEXT NOT NULL DEFAULT 'GIFT',
  "termsNote"    TEXT,
  "validDays"    INTEGER,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "startsAt"     TIMESTAMP(3),
  "endsAt"       TIMESTAMP(3),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CouponPolicy_code_key" ON "CouponPolicy"("code");
CREATE INDEX IF NOT EXISTS "CouponPolicy_trigger_isActive_idx" ON "CouponPolicy"("trigger", "isActive");

CREATE TABLE IF NOT EXISTS "IssuedCoupon" (
  "id"                   TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "policyId"             TEXT NOT NULL,
  "code"                 TEXT NOT NULL,
  "status"               "CouponStatus" NOT NULL DEFAULT 'HELD',
  "titleSnapshot"        TEXT NOT NULL,
  "rewardLabelSnapshot"  TEXT NOT NULL,
  "rewardAmountSnapshot" INTEGER,
  "issuedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"            TIMESTAMP(3),
  "qualifiedQuoteId"     TEXT,
  "qualifiedAt"          TIMESTAMP(3),
  "paidAt"               TIMESTAMP(3),
  "paidBy"               TEXT,
  "paidMemo"             TEXT,
  "revokedAt"            TIMESTAMP(3),
  "revokeReason"         TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IssuedCoupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IssuedCoupon_code_key" ON "IssuedCoupon"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "IssuedCoupon_userId_policyId_key" ON "IssuedCoupon"("userId", "policyId");
CREATE INDEX IF NOT EXISTS "IssuedCoupon_userId_status_idx" ON "IssuedCoupon"("userId", "status");
CREATE INDEX IF NOT EXISTS "IssuedCoupon_status_issuedAt_idx" ON "IssuedCoupon"("status", "issuedAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IssuedCoupon_userId_fkey') THEN
    ALTER TABLE "IssuedCoupon"
      ADD CONSTRAINT "IssuedCoupon_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IssuedCoupon_policyId_fkey') THEN
    ALTER TABLE "IssuedCoupon"
      ADD CONSTRAINT "IssuedCoupon_policyId_fkey"
      FOREIGN KEY ("policyId") REFERENCES "CouponPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 초기 정책 2건. 금액·문구는 어드민에서 수정한다.
INSERT INTO "CouponPolicy"
  ("id", "code", "trigger", "title", "description", "rewardLabel", "rewardAmount", "rewardKind", "termsNote", "validDays", "displayOrder")
VALUES
  ('cpol_signup_fuel_100k', 'SIGNUP_FUEL_100K', 'SIGNUP',
   '첫가입 축하 주유권', '계약을 완료하면 지급돼요', '주유권 10만원', 100000, 'FUEL',
   '계약 완료 후 영업담당자 확인을 거쳐 지급됩니다.', 90, 10),
  ('cpol_first_contract_cash_300k', 'FIRST_CONTRACT_CASH_300K', 'FIRST_CONTRACT',
   '첫계약 축하금', '영업담당자 확인 후 순차 지급돼요', '축하금 30만원', 300000, 'CASH',
   '차량 인도 완료 후 지급됩니다.', NULL, 20)
ON CONFLICT ("code") DO NOTHING;
