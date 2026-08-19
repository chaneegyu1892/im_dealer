-- T19: IssuedCoupon 복합 유니크 정합(드리프트 기록 + 신규 환경 수렴).
--
-- 목표 상태는 프로덕션 실측(2026-08-19, 읽기 전용 조회)과 동일하다:
--   IssuedCoupon_nonreferral_unique  ("userId", "policyId")     WHERE "referralId" IS NULL
--   IssuedCoupon_referral_unique     ("policyId", "referralId") WHERE "referralId" IS NOT NULL
-- 프로덕션에는 이미 두 인덱스가 존재하고 중복 행이 없으므로(16행, 중복 0건), 이
-- 마이그레이션의 모든 문은 프로덕션에서 no-op 이다. 마이그레이션 리플레이로 만든
-- 신규 환경에서만 실제 DDL 이 실행되어 프로덕션과 같은 모양으로 수렴한다.
--
-- 왜 (userId, policyId) 풀 유니크가 아니라 부분 유니크 2개인가:
--   reconcile 경로(SIGNUP/FIRST_CONTRACT, referralId 항상 NULL)는 회원×정책 1장이
--   맞지만, 추천 경로(applyReferralOnProfileComplete)의 REFERRAL_GIVEN 은 추천인이
--   피추천인마다 발급된다(월 상한 10건, attribution.ts REFERRAL_MONTHLY_CAP). 같은
--   userId+policyId 로 여러 장이 정상 상태라서 풀 유니크는 이 경로를 깨뜨린다.
--   Prisma 는 partial unique 를 표현하지 못해 schema.prisma 에는 선언이 없고
--   이 마이그레이션이 단일 진실 공급원이 된다.

-- 1) 추천 트리거 enum 값. 프로덕션/스키마에는 이미 있고, 리플레이 환경 보충.
--    신규 값을 이 트랜잭션 안에서 다시 참조하지 않는다(PG12+ 제약 준수).
ALTER TYPE "CouponTrigger" ADD VALUE IF NOT EXISTS 'REFERRAL_RECEIVED';
ALTER TYPE "CouponTrigger" ADD VALUE IF NOT EXISTS 'REFERRAL_GIVEN';

-- 2) referralId 컬럼·인덱스. 동일하게 리플레이 환경 보충.
ALTER TABLE "IssuedCoupon" ADD COLUMN IF NOT EXISTS "referralId" TEXT;
CREATE INDEX IF NOT EXISTS "IssuedCoupon_referralId_idx" ON "IssuedCoupon"("referralId");

-- 3) FK. Referral 테이블 자체의 DDL 은 추천 기능 마이그레이션 소관이라 여기서
--    만들지 않는다. 테이블이 이미 있는 환경(프로덕션)에서만 제약을 맞춘다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = 'Referral'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conname = 'IssuedCoupon_referralId_fkey'
  ) THEN
    ALTER TABLE "IssuedCoupon"
      ADD CONSTRAINT "IssuedCoupon_referralId_fkey"
      FOREIGN KEY ("referralId") REFERENCES "Referral"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) 사전 중복 제거. 유니크 생성 전에만 실행되고 각 그룹의 낙오 행만 건드린다.
--    보관 행 우선순위: PAID(이미 지급된 돈은 건드리지 않는다) > 최초 발급
--    (issuedAt, id 오름차순).
--    낙오 행을 REVOKED 폐기가 아니라 삭제하는 이유: 아래 부분 유니크는 프로덕션
--    실측과 동일하게 상태와 무관하게 referralId IS NULL 행 전체에 키를 점유시킨다.
--    폐기로 남기면 낙오 행이 여전히 키를 점유해 색인 생성이 실패한다. 낙오 행은
--    경쟁·재시도로 생긴 미사용 아티팩트(HELD/PENDING/EXPIRED)라 감사 대상이 아니다.
--    PAID 중복(이중 지급)은 자동 삭제하지 않고 그대로 두어 색인 생성이 실패하게
--    만든다 — 이중 지급은 자동 정리가 아니라 사람이 확인해야 하는 이상치다.
WITH "ranked_nonreferral" AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "userId", "policyId"
           ORDER BY (status = 'PAID') DESC, "issuedAt" ASC, "id" ASC
         ) AS rn
  FROM "IssuedCoupon"
  WHERE "referralId" IS NULL
)
DELETE FROM "IssuedCoupon"
WHERE "id" IN (SELECT "id" FROM "ranked_nonreferral" WHERE rn > 1)
  AND status IN ('HELD', 'PENDING', 'EXPIRED');

WITH "ranked_referral" AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "policyId", "referralId"
           ORDER BY (status = 'PAID') DESC, "issuedAt" ASC, "id" ASC
         ) AS rn
  FROM "IssuedCoupon"
  WHERE "referralId" IS NOT NULL
)
DELETE FROM "IssuedCoupon"
WHERE "id" IN (SELECT "id" FROM "ranked_referral" WHERE rn > 1)
  AND status IN ('HELD', 'PENDING', 'EXPIRED');

-- 5) add_coupon_box 가 만든 풀 유니크 제거. REFERRAL_GIVEN 다중 보유와 충돌한다.
--    프로덕션에는 이 인덱스가 없으므로(실측 확인) no-op, 리플레이 환경에서만 삭제.
DROP INDEX IF EXISTS "IssuedCoupon_userId_policyId_key";

-- 6) 부분 유니크 생성. 이름은 프로덕션 실측과 동일하게 맞춘다.
CREATE UNIQUE INDEX IF NOT EXISTS "IssuedCoupon_nonreferral_unique"
  ON "IssuedCoupon"("userId", "policyId")
  WHERE "referralId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IssuedCoupon_referral_unique"
  ON "IssuedCoupon"("policyId", "referralId")
  WHERE "referralId" IS NOT NULL;
