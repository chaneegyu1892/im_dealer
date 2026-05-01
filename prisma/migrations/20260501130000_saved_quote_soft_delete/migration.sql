-- SavedQuote 소프트 삭제 컬럼 + 인덱스
ALTER TABLE "SavedQuote" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "SavedQuote_deletedAt_idx" ON "SavedQuote"("deletedAt");
