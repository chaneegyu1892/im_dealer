-- 견적서 카카오톡 전송 기능.
-- User 컬럼 추가는 nullable, QuoteDelivery 는 신규 테이블 → 기존 데이터 영향 없음.

-- 카카오 리프레시 토큰(AES-256-GCM 암호문). 평문 저장 금지.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kakaoRefreshToken" TEXT;

CREATE TABLE IF NOT EXISTS "QuoteDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedQuoteId" TEXT,
    "vehicleName" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'memo',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuoteDelivery_userId_createdAt_idx" ON "QuoteDelivery"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "QuoteDelivery_status_createdAt_idx" ON "QuoteDelivery"("status", "createdAt");

ALTER TABLE "QuoteDelivery"
  ADD CONSTRAINT "QuoteDelivery_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
