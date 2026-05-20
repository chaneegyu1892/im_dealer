-- 외부 차량 데이터 소스 JSON 임포트를 위한 스키마 확장
-- 모든 컬럼 nullable + 기존 데이터 무영향

-- Vehicle
ALTER TABLE "Vehicle"
  ADD COLUMN "externalId"     TEXT,
  ADD COLUMN "externalSource" TEXT;
CREATE UNIQUE INDEX "Vehicle_externalId_key" ON "Vehicle"("externalId");
CREATE INDEX "Vehicle_externalSource_idx" ON "Vehicle"("externalSource");

-- VehicleLineup
ALTER TABLE "VehicleLineup"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "metadata"   JSONB;
CREATE UNIQUE INDEX "VehicleLineup_externalId_key" ON "VehicleLineup"("externalId");

-- Trim
ALTER TABLE "Trim"
  ADD COLUMN "externalId"    TEXT,
  ADD COLUMN "detailedSpecs" JSONB;
CREATE UNIQUE INDEX "Trim_externalId_key" ON "Trim"("externalId");

-- TrimOption (트림별로 같은 옵션 ID 반복되므로 trimId 와 함께 unique)
ALTER TABLE "TrimOption"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "metadata"   JSONB;
CREATE UNIQUE INDEX "TrimOption_trimId_externalId_key" ON "TrimOption"("trimId", "externalId");

-- VehicleColor (vehicleId + kind + externalId unique)
ALTER TABLE "VehicleColor"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "mfgCode"    TEXT,
  ADD COLUMN "metadata"   JSONB;
CREATE UNIQUE INDEX "VehicleColor_vehicleId_kind_externalId_key" ON "VehicleColor"("vehicleId", "kind", "externalId");
