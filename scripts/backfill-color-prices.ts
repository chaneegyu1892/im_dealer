/**
 * 트림 단위 색상 추가요금 백필 스크립트
 *
 * 배경: 초기 import-vehicles.ts 는 모델 단위(modelDetail.colorExt/Int)의 색상 가격만
 *       VehicleColor.priceDelta 로 넣었고, 트림 단위(trim.colorExt/Int)에만 가격이 있는
 *       차량은 0원으로 누락되었다. 이 스크립트가 원본 JSON 의 트림 단위 가격을 모델 단위로
 *       병합(색상 externalId 기준 최댓값)하여 누락분을 보정한다.
 *
 * 안전장치:
 *   - 기존값보다 "큰" 경우에만 갱신 → 어드민에서 수동 입력한 값(예: 테슬라 Model Y Pearl White)은 보존.
 *   - 기본은 dry-run(미적용). 실제 반영은 --apply 플래그 필요.
 *
 * 사용법:
 *   pnpm tsx scripts/backfill-color-prices.ts            # dry-run (변경 예정만 출력)
 *   pnpm tsx scripts/backfill-color-prices.ts --apply    # 실제 DB 반영
 */
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parseColorTsv } from "../src/lib/vehicle-import-mappings";

const prisma = new PrismaClient();

// 국산 데이터만 대상. 수입차(raw_data_imported_car.json)는 트림마다 색상가가 제각각이고
// 극단값(예: 마세라티 2,580만원, 테슬라 트림별 무료/유료 혼재)이라 per-vehicle 모델로는
// 과청구가 되므로 자동 백필에서 제외한다. 수입차 색상가는 어드민 수동 관리.
const FILES = ["raw_data_ko_car.json"];

type KindMap = { EXTERIOR: Map<string, number>; INTERIOR: Map<string, number> };

// modelId → { EXTERIOR: colorId→최댓값, INTERIOR: colorId→최댓값 }
function buildPriceIndex(): Map<string, KindMap> {
  const index = new Map<string, KindMap>();

  for (const file of FILES) {
    const full = path.resolve(file);
    const data = JSON.parse(readFileSync(full, "utf-8")) as {
      brands: Record<string, { models?: Record<string, ExternalEntry> }>;
    };

    for (const brand of Object.values(data.brands)) {
      for (const [modelId, entry] of Object.entries(brand.models ?? {})) {
        const detail = entry.detail ?? {};
        const md = detail.model?.[modelId] ?? {};
        const km: KindMap = { EXTERIOR: new Map(), INTERIOR: new Map() };

        const accumulate = (target: Map<string, number>, tsv: string | undefined) => {
          for (const row of parseColorTsv(tsv)) {
            if (row.priceDelta > 0) {
              target.set(row.id, Math.max(target.get(row.id) ?? 0, row.priceDelta));
            }
          }
        };

        // 모델 단위
        accumulate(km.EXTERIOR, md.colorExt);
        accumulate(km.INTERIOR, md.colorInt);
        // 트림 단위 (최댓값 병합)
        for (const trim of Object.values(detail.trim ?? {})) {
          accumulate(km.EXTERIOR, trim.colorExt);
          accumulate(km.INTERIOR, trim.colorInt);
        }

        index.set(modelId, km);
      }
    }
  }
  return index;
}

interface ExternalEntry {
  detail?: {
    model?: Record<string, { colorExt?: string; colorInt?: string }>;
    trim?: Record<string, { colorExt?: string; colorInt?: string }>;
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`색상 추가요금 백필 시작 (mode=${apply ? "APPLY" : "DRY-RUN"})\n`);

  const index = buildPriceIndex();

  const vehicles = await prisma.vehicle.findMany({
    where: { externalId: { not: null } },
    select: {
      name: true,
      brand: true,
      externalId: true,
      colors: { select: { id: true, externalId: true, kind: true, priceDelta: true, name: true } },
    },
  });

  let updated = 0;
  let skippedManual = 0;
  const changedVehicles = new Set<string>();

  for (const v of vehicles) {
    const km = v.externalId ? index.get(v.externalId) : undefined;
    if (!km) continue;

    for (const c of v.colors) {
      if (!c.externalId) continue;
      const computed = km[c.kind as "EXTERIOR" | "INTERIOR"].get(c.externalId) ?? 0;
      if (computed <= 0) continue;

      if (computed > c.priceDelta) {
        console.log(
          `  ↑ ${v.brand} ${v.name} | ${c.kind === "EXTERIOR" ? "외장" : "내장"} | ${c.name}: ${c.priceDelta / 10000}만원 → ${computed / 10000}만원`
        );
        changedVehicles.add(`${v.brand} ${v.name}`);
        if (apply) {
          await prisma.vehicleColor.update({ where: { id: c.id }, data: { priceDelta: computed } });
        }
        updated++;
      } else if (computed < c.priceDelta) {
        // 기존값이 더 큼 → 수동 오버라이드로 간주, 보존
        skippedManual++;
      }
    }
  }

  console.log(`\n── 요약 ──`);
  console.log(`${apply ? "갱신됨" : "갱신 예정"}: ${updated}개 색상 / 차량 ${changedVehicles.size}대`);
  console.log(`보존(기존값이 더 큼, 수동 오버라이드 추정): ${skippedManual}개`);
  if (!apply) console.log(`\n실제 반영하려면: pnpm tsx scripts/backfill-color-prices.ts --apply`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
