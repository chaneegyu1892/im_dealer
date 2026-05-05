-- AdminUser.supabaseId : Supabase auth user.id 와 1:1 연결 (Supabase 세션 기반 로그인용)
ALTER TABLE "AdminUser" ADD COLUMN "supabaseId" TEXT;

-- 1:1 매칭 보장
CREATE UNIQUE INDEX "AdminUser_supabaseId_key" ON "AdminUser"("supabaseId");

-- passwordHash : 레거시 JWT/bcrypt 인증 잔재. Supabase 전환 후 신규 어드민은 비어 있음.
ALTER TABLE "AdminUser" ALTER COLUMN "passwordHash" DROP NOT NULL;
