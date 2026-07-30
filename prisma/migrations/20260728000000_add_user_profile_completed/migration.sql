-- 간편가입: 이름·전화 수집 폼 완료 여부 플래그
ALTER TABLE "User" ADD COLUMN "profileCompleted" BOOLEAN NOT NULL DEFAULT false;

-- 기존 사용자 보정: 전화번호를 이미 보유했거나 어드민 계열 role 은 완료로 간주해
-- 재로그인 시 가입완료 폼으로 다시 유도되지 않도록 한다.
UPDATE "User"
SET "profileCompleted" = true
WHERE ("phone" IS NOT NULL AND "phone" <> '') OR "role" <> 'member';
