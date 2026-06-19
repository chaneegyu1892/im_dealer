ALTER TABLE "RecommendationLog" ADD COLUMN IF NOT EXISTS "chargingEnvironment" TEXT;
ALTER TABLE "RecommendationLog" ADD COLUMN IF NOT EXISTS "residenceRegion" TEXT;
