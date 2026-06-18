-- 차량 탐색(/cars) "주목할 차량" 슬라이더 노출 플래그 추가 (isPopular와 별개, 비파괴 추가형)
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "isSpotlight" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Vehicle_isVisible_isSpotlight_idx" ON "Vehicle" ("isVisible", "isSpotlight");
