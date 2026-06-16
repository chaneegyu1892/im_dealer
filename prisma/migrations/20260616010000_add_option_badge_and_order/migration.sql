-- 옵션 추천 배지(전역 라벨 목록) + 옵션 노출 순서/배지 참조 추가 (추가형 비파괴)

-- CreateTable
CREATE TABLE IF NOT EXISTS "OptionBadge" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OptionBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OptionBadge_label_key" ON "OptionBadge"("label");

-- AlterTable
ALTER TABLE "TrimOption" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrimOption" ADD COLUMN IF NOT EXISTS "badgeId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrimOption_badgeId_idx" ON "TrimOption"("badgeId");

-- AddForeignKey (중복 생성 방지 가드)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrimOption_badgeId_fkey'
  ) THEN
    ALTER TABLE "TrimOption"
      ADD CONSTRAINT "TrimOption_badgeId_fkey"
      FOREIGN KEY ("badgeId") REFERENCES "OptionBadge"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
