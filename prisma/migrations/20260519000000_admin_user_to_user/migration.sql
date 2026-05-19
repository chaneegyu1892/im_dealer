-- AdminUser → User 통합 마이그레이션
-- 일반 회원(member) 포함하는 단일 사용자 테이블로 일반화한다.

-- 1) 테이블 rename (행 데이터 보존)
ALTER TABLE "AdminUser" RENAME TO "User";

-- 2) email 의 unique 제약 해제 — Postgres 버전/Supabase 환경에 따라 이름이
--    "AdminUser_email_key" 그대로일 수도, "User_email_key"로 자동 변경될 수도 있어 양쪽 모두 처리.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'User' AND c.conname = 'AdminUser_email_key'
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT "AdminUser_email_key";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'User' AND c.conname = 'User_email_key'
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT "User_email_key";
  END IF;
END $$;

-- 3) 인덱스 이름 정리 (RENAME TABLE 시 자동 변경되지 않은 케이스 대비)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AdminUser_pkey') THEN
    ALTER INDEX "AdminUser_pkey" RENAME TO "User_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AdminUser_supabaseId_key') THEN
    ALTER INDEX "AdminUser_supabaseId_key" RENAME TO "User_supabaseId_key";
  END IF;
END $$;

-- 4) email nullable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- 5) role 기본값을 member 로 (기존 5명은 superadmin 그대로 유지)
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'member';

-- 6) 신규 컬럼
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "provider" TEXT;
ALTER TABLE "User" ADD COLUMN "kakaoNickname" TEXT;
ALTER TABLE "User" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 7) 인덱스 추가
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "User_email_idx" ON "User"("email");

-- 8) 감사 로그 FK 재선언 (행 데이터 미변경, constraint 만 교체)
ALTER TABLE "AdminAuditLog" DROP CONSTRAINT "AdminAuditLog_actorId_fkey";
ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
