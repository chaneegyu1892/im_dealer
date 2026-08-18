-- 간편가입 완료 시각. 추천인 코드 사후 입력 창구(가입 후 7일) 판정 기준.
ALTER TABLE "User" ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

-- 기존 완료 회원은 첫 로그인 시각(createdAt)으로 근사 백필한다.
-- 최근 가입자는 창구를 보장받고, 오래된 회원은 자연스럽게 창구가 닫힌 상태가 된다.
UPDATE "User" SET "profileCompletedAt" = "createdAt" WHERE "profileCompleted" = true;
