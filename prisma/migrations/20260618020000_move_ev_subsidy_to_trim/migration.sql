-- 전기차 보조금(evSubsidy)을 차량(Vehicle) 단위에서 트림(Trim) 단위로 이전한다.
-- 보조금은 견적 계산에 반영하지 않는 안내용 값이며, 트림(배터리 용량·차량가)에 따라
-- 다를 수 있어 트림 단위로 관리한다.

-- 1) Trim 에 컬럼 추가
ALTER TABLE "Trim" ADD COLUMN "evSubsidy" INTEGER;

-- 2) 기존 차량 단위 보조금을 해당 차량의 모든 트림으로 복사(데이터 보존)
UPDATE "Trim" t
SET "evSubsidy" = v."evSubsidy"
FROM "Vehicle" v
WHERE t."vehicleId" = v."id" AND v."evSubsidy" IS NOT NULL;

-- 3) Vehicle 의 보조금 컬럼 제거
ALTER TABLE "Vehicle" DROP COLUMN "evSubsidy";
