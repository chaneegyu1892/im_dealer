-- 「원하는 차」 선호 특징 개편: 다중 선호 + 상황형 상세 컬럼 추가.
-- 기존 행은 preferences 빈 배열로 채워지며 purpose/purposeDetail(레거시)은 유지된다.
ALTER TABLE "RecommendationLog" ADD COLUMN IF NOT EXISTS "preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "RecommendationLog" ADD COLUMN IF NOT EXISTS "childDetail" TEXT;
ALTER TABLE "RecommendationLog" ADD COLUMN IF NOT EXISTS "cargoDetail" TEXT;
