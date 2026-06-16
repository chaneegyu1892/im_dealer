-- VehicleLineup 고객 노출 여부. 같은 차량군은 기본적으로 최신 연식만 노출되며,
-- 운영자가 예외적으로 특정 연식을 숨기거나 노출하려면 이 값을 제어한다.
ALTER TABLE "VehicleLineup" ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN NOT NULL DEFAULT true;
