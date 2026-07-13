/**
 * 외부 차량 데이터 소스 JSON → Supabase Postgres 임포트 스크립트
 *
 * 사용법:
 *   pnpm tsx scripts/import-vehicles.ts --file raw_data_ko_car.json --dry-run
 *   pnpm tsx scripts/import-vehicles.ts --file raw_data_ko_car.json --model 11874
 *   pnpm tsx scripts/import-vehicles.ts --file raw_data_ko_car.json --brand 111
 *   pnpm tsx scripts/import-vehicles.ts --file raw_data_ko_car.json
 *   pnpm tsx scripts/import-vehicles.ts --all  # 국산 + 수입 둘 다
 *
 * 멱등 보장: externalId 기준 upsert. 재실행 안전.
 * 안전 정책: 신규 차량은 isVisible=false 로 들어감. 기존 27 차량은 externalSource IS NULL 이라 비대상.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CARTYPE_TO_CATEGORY,
  CARTYPE_LABEL,
  BRAND_TO_SLUG,
  makeExternalSlug,
  buildLegacySpecsShape,
} from "../src/lib/vehicle-import-mappings";
import { toPrismaJson } from "../src/lib/prisma-json";
import { buildLegacyVehicleUpsertData } from "../src/lib/vehicle-images/legacy-writer-policy";
import {
  createLegacyImportStats,
  type ExternalBrand,
  type ExternalFileFormat,
  type ExternalModelEntry,
} from "../src/lib/vehicle-images/legacy-import-types";
import { importLegacyLineupsAndTrims } from "../src/lib/vehicle-images/legacy-import-trims";
import { parseLegacyInteger } from "../src/lib/vehicle-images/legacy-import-values";
import { importLegacyVehicleColors } from "../src/lib/vehicle-images/legacy-import-colors";

const prisma = new PrismaClient();

const stats = createLegacyImportStats();

// ───────────────────────── 헬퍼 ─────────────────────────

// ───────────────────────── 모델 임포트 ─────────────────────────

type LegacyImportMode = {
  readonly dryRun: boolean;
  readonly mergeTrimColors: boolean;
};

async function importModel(
  brand: ExternalBrand,
  modelEntry: ExternalModelEntry,
  mode: LegacyImportMode,
): Promise<void> {
  const modelId = modelEntry.modelId;
  const modelDetail = modelEntry.detail.model?.[modelId];

  if (!modelDetail) {
    stats.errors.push({ modelId, error: "detail.model 누락" });
    return;
  }

  const name = modelDetail.name ?? modelEntry.listMeta?.name ?? `model-${modelId}`;
  const brandName = brand.name;
  const cartype = modelDetail.cartype ?? modelEntry.listMeta?.cartype;
  const category = CARTYPE_TO_CATEGORY[cartype ?? ""] ?? "세단";
  const basePrice = parseLegacyInteger(modelDetail.price?.min ?? modelEntry.listMeta?.priceMin);
  const slug = makeExternalSlug(brandName, modelId);

  // 기존 UI 가 인식하는 specs/technical_specs 구조 변환
  const legacyShape = buildLegacySpecsShape({
    spec: modelEntry.detail.spec,
    specGroup: modelEntry.detail.specGroup,
    specDefine: modelEntry.detail.specDefine,
    efficiency: modelDetail.efficiency,
  });

  // detailedSpecs jsonb — UI 호환 구조 + 원본 통째 보존
  const detailedSpecs = {
    name,
    brand: brandName,
    category,
    specs: legacyShape.specs,
    technical_specs: legacyShape.technical_specs,
    externalRaw: {
      listMeta: modelEntry.listMeta,
      model: modelDetail,
      lookups: {
        cartype: modelEntry.detail.cartype,
        engine: modelEntry.detail.engine,
      },
      cartypeLabel: CARTYPE_LABEL[cartype ?? ""] ?? cartype,
      files: modelEntry.detail.files,
      spec: modelEntry.detail.spec,
      specGroup: modelEntry.detail.specGroup,
      specDefine: modelEntry.detail.specDefine,
    },
  };

  if (mode.dryRun) {
    console.log(
      `[DRY] Vehicle ${modelId} (${name}, ${brandName}/${category}, ${basePrice.toLocaleString()}원, slug=${slug})`
    );
    stats.modelsProcessed++;
    return;
  }

  // 0) Brand upsert — 어드민 BrandList에서 보이도록 차량 이전에 등록.
  //    우선순위 5개(현대/기아/제네시스/BMW/벤츠, displayOrder 1~5)의 뒤에 가나다순으로
  //    배치되도록 신규 브랜드는 displayOrder=1000으로 통일한다.
  await prisma.brand.upsert({
    where: { name: brandName },
    create: { name: brandName, displayOrder: 1000 },
    update: {},
  });

  // 1) Vehicle upsert
  const existing = await prisma.vehicle.findUnique({ where: { externalId: modelId } });

  const vehicleWrite = buildLegacyVehicleUpsertData({
    slug,
    name,
    brand: brandName,
    category,
    vehicleCode: `${(BRAND_TO_SLUG[brandName] ?? "MDL").toUpperCase()}_${modelId}`,
    externalId: modelId,
    basePrice: basePrice || 0,
    description: modelDetail.summary,
    detailedSpecs: toPrismaJson(detailedSpecs),
  });
  const vehicle = await prisma.vehicle.upsert({
    where: { externalId: modelId },
    ...vehicleWrite,
  });

  if (existing) stats.modelsUpdated++;
  else stats.modelsCreated++;
  stats.modelsProcessed++;

  const lineups = modelEntry.detail.lineup ?? {};
  const trims = modelEntry.detail.trim ?? {};
  const { trimColorPriceExt, trimColorPriceInt } = await importLegacyLineupsAndTrims({
    prisma,
    vehicleId: vehicle.id,
    modelEntry,
    modelDetail,
    stats,
  });

  const colorCount = await importLegacyVehicleColors({
    prisma,
    vehicleId: vehicle.id,
    modelEntry,
    modelDetail,
    mergeTrimColors: mode.mergeTrimColors,
    trimColorPriceExt,
    trimColorPriceInt,
    stats,
  });

  console.log(
    `✓ ${modelId} ${name} — lineups ${Object.keys(lineups).length}, trims ${Object.keys(trims).length}, colors ${colorCount}`
  );
}

// ───────────────────────── 메인 ─────────────────────────

interface CliArgs {
  files: string[];
  brandFilter?: string;
  modelFilter?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = { files: [], dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--file") args.files.push(argv[++i] ?? "");
    else if (a === "--brand") args.brandFilter = argv[++i];
    else if (a === "--model") args.modelFilter = argv[++i];
    else if (a === "--all") {
      args.files.push("raw_data_ko_car.json", "raw_data_imported_car.json");
    }
  }

  if (args.files.length === 0) {
    throw new Error("--file <path> 또는 --all 필요");
  }
  return args;
}

async function main() {
  const args = parseArgs();
  console.log(`외부 차량 데이터 임포트 시작 (dryRun=${args.dryRun}, files=${args.files.join(",")})`);

  for (const file of args.files) {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) {
      console.error(`파일 없음: ${fullPath}`);
      continue;
    }
    const raw = fs.readFileSync(fullPath, "utf-8");
    const data: ExternalFileFormat = JSON.parse(raw);

    // 국산 데이터(raw_data_ko_car.json)만 트림 단위 색상 추가요금을 모델 단위로 병합.
    const mergeTrimColors = !file.includes("imported");

    console.log(`\n=== ${file} (${data.meta.modelCount} 모델) ===`);

    for (const [brandId, brand] of Object.entries(data.brands)) {
      if (args.brandFilter && brandId !== args.brandFilter) continue;

      for (const [modelId, model] of Object.entries(brand.models)) {
        if (args.modelFilter && modelId !== args.modelFilter) continue;

        try {
          await importModel(brand, { ...model, modelId }, {
            dryRun: args.dryRun,
            mergeTrimColors,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`✗ ${modelId} 실패: ${msg}`);
          stats.errors.push({ modelId, error: msg });
        }
      }
    }
  }

  console.log("\n========== 임포트 통계 ==========");
  console.log(`처리 모델: ${stats.modelsProcessed}`);
  console.log(`  신규:    ${stats.modelsCreated}`);
  console.log(`  업데이트: ${stats.modelsUpdated}`);
  console.log(`  스킵:    ${stats.modelsSkipped}`);
  console.log(`라인업:   ${stats.lineups}`);
  console.log(`트림:     ${stats.trims}`);
  console.log(`옵션:     ${stats.options}`);
  console.log(`색상:     ${stats.colors}`);
  console.log(`에러:     ${stats.errors.length}`);
  if (stats.errors.length > 0) {
    console.log("\n에러 상세:");
    for (const e of stats.errors.slice(0, 20)) {
      console.log(`  - ${e.modelId}: ${e.error}`);
    }
    if (stats.errors.length > 20) console.log(`  ... 외 ${stats.errors.length - 20}건`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
