-- Admin role: operator → staff (기존 operator 역할을 staff로 백필)
UPDATE "AdminUser" SET "role" = 'staff' WHERE "role" = 'operator';

-- SavedQuote: quoteType 컬럼 추가
ALTER TABLE "SavedQuote" ADD COLUMN "quoteType" TEXT NOT NULL DEFAULT 'DETAIL';

-- SavedQuote: updatedAt 컬럼 추가
ALTER TABLE "SavedQuote" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
