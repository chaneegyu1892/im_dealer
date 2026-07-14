-- QuoteCalcLog를 세션/차량/시나리오별 최신 1건으로 유지하고,
-- 원본 차량 데이터가 변경되어도 당시 견적 구성을 확인할 수 있게 스냅샷을 보강한다.

ALTER TABLE "QuoteCalcLog"
  ADD COLUMN "vehicleBrand" TEXT,
  ADD COLUMN "trimName" TEXT,
  ADD COLUMN "trimPrice" INTEGER,
  ADD COLUMN "discountPrice" INTEGER,
  ADD COLUMN "optionSnapshots" JSONB,
  ADD COLUMN "extraOptionsPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "optionsTotalPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "exteriorColorId" TEXT,
  ADD COLUMN "exteriorColorName" TEXT,
  ADD COLUMN "interiorColorId" TEXT,
  ADD COLUMN "interiorColorName" TEXT,
  ADD COLUMN "colorDelta" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalVehiclePrice" INTEGER,
  ADD COLUMN "customerType" TEXT,
  ADD COLUMN "pricingStatus" "QuotePricingStatus" NOT NULL DEFAULT 'CALCULATED',
  ADD COLUMN "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "QuoteCalcLog"
SET "calculatedAt" = "createdAt";

-- 기존 행은 현재 원본 데이터를 기준으로 가능한 범위만 보강한다.
-- 가격/명칭이 이미 변경됐을 수 있으므로 totalVehiclePrice는 소급 계산하지 않는다.
UPDATE "QuoteCalcLog" AS q
SET "vehicleBrand" = v."brand"
FROM "Vehicle" AS v
WHERE v."id" = q."vehicleId";

UPDATE "QuoteCalcLog" AS q
SET
  "trimName" = t."name",
  "trimPrice" = t."price",
  "discountPrice" = t."discountPrice"
FROM "Trim" AS t
WHERE t."id" = q."trimId";

UPDATE "QuoteCalcLog" AS q
SET
  "optionSnapshots" = COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object('id', o."id", 'name', o."name", 'price', o."price")
        ORDER BY o."displayOrder", o."createdAt"
      )
      FROM "TrimOption" AS o
      WHERE o."id" = ANY(q."optionIds")
    ),
    '[]'::jsonb
  ),
  "optionsTotalPrice" = COALESCE(
    (
      SELECT SUM(o."price")::integer
      FROM "TrimOption" AS o
      WHERE o."id" = ANY(q."optionIds")
    ),
    0
  );

-- SavedQuote가 이미 존재하는 세션은 과거 플래그 누락 여부와 관계없이 상담 전환으로 맞춘다.
UPDATE "QuoteCalcLog" AS q
SET "clickedApply" = TRUE
FROM "SavedQuote" AS s
WHERE s."sessionId" = q."sessionId";

-- 기존 중복 중 최신 행을 남기되, 같은 그룹에서 한 번이라도 신청을 클릭했다면 보존한다.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "sessionId", "vehicleSlug", "scenarioType"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS row_number,
    BOOL_OR("clickedApply") OVER (
      PARTITION BY "sessionId", "vehicleSlug", "scenarioType"
    ) AS any_clicked_apply
  FROM "QuoteCalcLog"
)
UPDATE "QuoteCalcLog" AS q
SET "clickedApply" = TRUE
FROM ranked AS r
WHERE q."id" = r."id"
  AND r.row_number = 1
  AND r.any_clicked_apply = TRUE;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "sessionId", "vehicleSlug", "scenarioType"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "QuoteCalcLog"
)
DELETE FROM "QuoteCalcLog" AS q
USING ranked AS r
WHERE q."id" = r."id"
  AND r.row_number > 1;

CREATE UNIQUE INDEX "QuoteCalcLog_session_vehicle_scenario_key"
ON "QuoteCalcLog"("sessionId", "vehicleSlug", "scenarioType");

CREATE INDEX "QuoteCalcLog_calculatedAt_idx"
ON "QuoteCalcLog"("calculatedAt");
