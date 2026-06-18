-- 금융사 로고 URL 추가 (견적서 PDF 노출용, nullable·비파괴 추가형)

-- AlterTable
ALTER TABLE "FinanceCompany" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
