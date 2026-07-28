-- 카카오싱크(간편가입) 동의 결과 저장 컬럼.
-- 전부 nullable/기본값 있음 → 기존 행에 영향 없음.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kakaoId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "channelRelation" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "consentedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_kakaoId_key" ON "User"("kakaoId");
CREATE INDEX IF NOT EXISTS "User_channelRelation_idx" ON "User"("channelRelation");
