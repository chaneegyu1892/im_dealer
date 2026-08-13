-- 배지 부착 단위 이전: 트림 옵션 행(TrimOption.badgeId) → 차량 단위 옵션명(VehicleOptionBadge)
-- 같은 이름의 옵션이 어느 트림/연식에 있든 배지가 함께 노출되도록 하고,
-- 외부 재동기화로 트림 옵션이 재생성되어도 배지가 유실되지 않게 한다.
-- 절차: 1) 매핑 테이블 생성 → 2) 기존 트림별 지정값을 옵션명 단위로 승격 → 3) TrimOption.badgeId 제거

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleOptionBadge" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleOptionBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleOptionBadge_vehicleId_optionName_key" ON "VehicleOptionBadge"("vehicleId", "optionName");
CREATE INDEX IF NOT EXISTS "VehicleOptionBadge_badgeId_idx" ON "VehicleOptionBadge"("badgeId");

-- AddForeignKey (중복 생성 방지 가드)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VehicleOptionBadge_vehicleId_fkey'
  ) THEN
    ALTER TABLE "VehicleOptionBadge"
      ADD CONSTRAINT "VehicleOptionBadge_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'VehicleOptionBadge_badgeId_fkey'
  ) THEN
    ALTER TABLE "VehicleOptionBadge"
      ADD CONSTRAINT "VehicleOptionBadge_badgeId_fkey"
      FOREIGN KEY ("badgeId") REFERENCES "OptionBadge"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 기존 트림별 배지 지정값 승격.
-- (차량, 공백 정규화한 옵션명)별로 가장 많이 지정된 배지를 채택(동률이면 먼저 지정된 배지).
-- 이미 존재하는 매핑은 덮어쓰지 않는다(재실행 안전).
INSERT INTO "VehicleOptionBadge" ("id", "vehicleId", "optionName", "badgeId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, ranked."vehicleId", ranked."optionName", ranked."badgeId", NOW(), NOW()
FROM (
  SELECT
    t."vehicleId",
    btrim(regexp_replace(o."name", '\s+', ' ', 'g')) AS "optionName",
    o."badgeId",
    ROW_NUMBER() OVER (
      PARTITION BY t."vehicleId", btrim(regexp_replace(o."name", '\s+', ' ', 'g'))
      ORDER BY COUNT(*) DESC, MIN(o."createdAt") ASC
    ) AS rn
  FROM "TrimOption" o
  JOIN "Trim" t ON t."id" = o."trimId"
  WHERE o."badgeId" IS NOT NULL
  GROUP BY t."vehicleId", btrim(regexp_replace(o."name", '\s+', ' ', 'g')), o."badgeId"
) ranked
WHERE ranked.rn = 1
ON CONFLICT ("vehicleId", "optionName") DO NOTHING;

-- DropColumn: TrimOption.badgeId 제거 (승격 후)
ALTER TABLE "TrimOption" DROP CONSTRAINT IF EXISTS "TrimOption_badgeId_fkey";
DROP INDEX IF EXISTS "TrimOption_badgeId_idx";
ALTER TABLE "TrimOption" DROP COLUMN IF EXISTS "badgeId";
