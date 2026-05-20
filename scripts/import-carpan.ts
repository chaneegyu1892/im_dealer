/**
 * carpan.kr JSON → Supabase Postgres 임포트 스크립트
 *
 * 사용법:
 *   pnpm tsx scripts/import-carpan.ts --file raw_data_ko_car.json --dry-run
 *   pnpm tsx scripts/import-carpan.ts --file raw_data_ko_car.json --model 11874
 *   pnpm tsx scripts/import-carpan.ts --file raw_data_ko_car.json --brand 111
 *   pnpm tsx scripts/import-carpan.ts --file raw_data_ko_car.json
 *   pnpm tsx scripts/import-carpan.ts --all  # 국산 + 수입 둘 다
 *
 * 멱등 보장: externalId 기준 upsert. 재실행 안전.
 * 안전 정책: 신규 차량은 isVisible=false 로 들어감. 기존 27 차량은 externalSource IS NULL 이라 비대상.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CARTYPE_TO_CATEGORY,
  CARTYPE_LABEL,
  pickPrimaryEngine,
  carpanImageUrl,
  makeCarpanSlug,
  isCurrentlySold,
  parseColorTsv,
  parseOptionTsv,
  normalizeHex,
  pickRepresentativeEfficiency,
  mapOptionKind,
} from "../src/lib/carpan-mappings";

const prisma = new PrismaClient();

// ───────────────────────── JSON 타입 (필요 부분만) ─────────────────────────

interface CarpanFile {
  url1?: string;
  url2?: string;
  url3?: string;
  kind?: string;
  name?: string;
  count?: number;
  dir?: string;
}

interface CarpanModel {
  name?: string;
  open?: string;
  update?: string;
  state?: string;
  cartype?: string;
  image?: string;
  imageL?: string;
  cover?: string;
  delivery?: string;
  deliveryShip?: string;
  catalogF?: string;
  priceF?: string;
  summary?: string;
  homepage?: string;
  warranty?: string;
  brand?: string;
  lineup?: string;
  option?: string;
  colorExt?: string;
  colorInt?: string;
  spec?: Record<string, string>;
  price?: { min?: number | string; max?: number | string };
  displace?: { min?: string; max?: string };
  power?: { min?: number; max?: number };
  engine?: string;
  efficiency?: Record<string, { name?: string; min?: string; max?: string; unit?: string }>;
}

interface CarpanLineup {
  catalogF?: string;
  priceF?: string;
  cover?: string;
  imageL?: string;
  image?: string;
  model?: string;
  open?: string;
  state?: string;
  cartype?: string;
  name?: string;
  year?: string;
  trim?: string;
  price?: { min?: number | string; max?: number | string };
  displace?: { min?: string; max?: string };
  engine?: string;
  colorExt?: string;
  colorInt?: string;
  spec?: Record<string, string>;
  efficiency?: Record<string, { name?: string; min?: string; max?: string; unit?: string }>;
  power?: { min?: number; max?: number };
  items?: string;
}

interface CarpanTrim {
  lineup?: string;
  name?: string;
  tm?: string;
  state?: string;
  cartype?: string;
  open?: string;
  division?: string;
  extra?: string;
  engine?: string;
  displace?: string;
  person?: string;
  carry?: string;
  price?: string;
  tax?: string;
  option?: string;
  colorExt?: string;
  colorInt?: string;
  items?: string;
  itemsLink?: string;
  spec?: Record<string, string>;
  specoption?: Record<string, Record<string, string>>;
}

interface CarpanOption {
  name?: string;
  kind?: string;
  apply?: string;
  extNot?: string;
  intNot?: string;
  extJoin?: string;
  intJoin?: string;
  guide?: string;
  package?: string;
  packageRemark?: string;
  change?: string;
  items?: string;
}

interface CarpanColorExt {
  name?: string;
  code?: string;
  group?: string;
  rgb?: string;
  rgb2?: string;
  optionJoin?: string;
  optionNot?: string;
  intNot?: string;
}

interface CarpanColorInt {
  name?: string;
  group?: string;
  rgb?: string;
  rgb2?: string;
  optionJoin?: string;
  optionNot?: string;
  extNot?: string;
}

interface CarpanDocument {
  content?: string;
  remark?: string;
  link?: string;
  table?: string;
  tableIdx?: string;
}

interface CarpanModelEntry {
  modelId: string;
  listMeta?: {
    name?: string;
    state?: string;
    image?: string;
    priceMin?: string;
    priceMax?: string;
    recentMY?: string;
  };
  detail: {
    brand?: Record<string, { name?: string; logo?: string; local?: string }>;
    cartype?: Record<string, { name?: string }>;
    engine?: Record<string, { name?: string }>;
    model?: Record<string, CarpanModel>;
    lineup?: Record<string, CarpanLineup>;
    trim?: Record<string, CarpanTrim>;
    option?: Record<string, CarpanOption>;
    colorExt?: Record<string, CarpanColorExt>;
    colorInt?: Record<string, CarpanColorInt>;
    document?: Record<string, CarpanDocument>;
    spec?: Record<string, Record<string, string>>;
    specGroup?: Record<string, { name?: string; list?: string }>;
    specDefine?: Record<string, { name?: string; unit?: string; group?: string }>;
    files?: Record<string, CarpanFile>;
  };
}

interface CarpanBrand {
  brandId: string;
  name: string;
  meta?: { logo?: string };
  models: Record<string, CarpanModelEntry>;
}

interface CarpanFileFormat {
  meta: { source: string; brandCount: number; modelCount: number };
  lookups: Record<string, unknown>;
  brands: Record<string, CarpanBrand>;
}

// ───────────────────────── 통계 ─────────────────────────

interface ImportStats {
  modelsProcessed: number;
  modelsCreated: number;
  modelsUpdated: number;
  modelsSkipped: number;
  lineups: number;
  trims: number;
  options: number;
  colors: number;
  errors: { modelId: string; error: string }[];
}

const stats: ImportStats = {
  modelsProcessed: 0,
  modelsCreated: 0,
  modelsUpdated: 0,
  modelsSkipped: 0,
  lineups: 0,
  trims: 0,
  options: 0,
  colors: 0,
  errors: [],
};

// ───────────────────────── 헬퍼 ─────────────────────────

function toInt(v: string | number | undefined | null): number {
  if (v == null) return 0;
  if (typeof v === "number") return Math.round(v);
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function splitCsv(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ───────────────────────── 모델 임포트 ─────────────────────────

async function importModel(
  brand: CarpanBrand,
  modelEntry: CarpanModelEntry,
  dryRun: boolean
): Promise<void> {
  const modelId = modelEntry.modelId;
  const modelDetail = modelEntry.detail.model?.[modelId];

  if (!modelDetail) {
    stats.errors.push({ modelId, error: "detail.model 누락" });
    return;
  }

  const name = modelDetail.name ?? modelEntry.listMeta?.name ?? `model-${modelId}`;
  const brandName = brand.name;
  const cartype = modelDetail.cartype ?? modelEntry.listMeta?.["cartype" as keyof typeof modelEntry.listMeta];
  const category = CARTYPE_TO_CATEGORY[cartype ?? ""] ?? "세단";
  const basePrice = toInt(modelDetail.price?.min ?? modelEntry.listMeta?.priceMin);
  const thumbnailUrl = carpanImageUrl(modelDetail.image ?? modelEntry.listMeta?.image);
  const slug = makeCarpanSlug(brandName, modelId);

  // imageUrls: cover + imageL 등 모은 것
  const imageUrls = [
    carpanImageUrl(modelDetail.imageL),
    carpanImageUrl(modelDetail.cover),
  ].filter(Boolean);

  // detailedSpecs jsonb — JSON 의 model + carpan 사전 통째 보존
  const detailedSpecs = {
    carpanRaw: {
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

  if (dryRun) {
    console.log(
      `[DRY] Vehicle ${modelId} (${name}, ${brandName}/${category}, ${basePrice.toLocaleString()}원, slug=${slug})`
    );
    stats.modelsProcessed++;
    return;
  }

  // 1) Vehicle upsert
  const existing = await prisma.vehicle.findUnique({ where: { externalId: modelId } });

  const vehicle = await prisma.vehicle.upsert({
    where: { externalId: modelId },
    create: {
      slug,
      name,
      brand: brandName,
      category,
      vehicleCode: `CARPAN_${modelId}`,
      externalId: modelId,
      externalSource: "carpan",
      basePrice: basePrice || 0,
      thumbnailUrl,
      imageUrls,
      description: modelDetail.summary,
      isVisible: false, // 안전: 어드민 검증 후 수동 노출
      detailedSpecs: detailedSpecs as unknown as Prisma.InputJsonValue,
    },
    update: {
      name,
      brand: brandName,
      category,
      basePrice: basePrice || 0,
      thumbnailUrl,
      imageUrls,
      description: modelDetail.summary,
      detailedSpecs: detailedSpecs as unknown as Prisma.InputJsonValue,
    },
  });

  if (existing) stats.modelsUpdated++;
  else stats.modelsCreated++;
  stats.modelsProcessed++;

  // 2) Lineup 들 임포트
  const lineups = modelEntry.detail.lineup ?? {};
  const lineupIdMap = new Map<string, string>(); // externalId → cuid

  for (const [lineupExtId, lineup] of Object.entries(lineups)) {
    const created = await prisma.vehicleLineup.upsert({
      where: { externalId: lineupExtId },
      create: {
        vehicleId: vehicle.id,
        name: lineup.name ?? `lineup-${lineupExtId}`,
        externalId: lineupExtId,
        metadata: lineup as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: lineup.name ?? `lineup-${lineupExtId}`,
        metadata: lineup as unknown as Prisma.InputJsonValue,
      },
    });
    lineupIdMap.set(lineupExtId, created.id);
    stats.lineups++;
  }

  // 3) Trim 들 임포트
  const trims = modelEntry.detail.trim ?? {};
  const trimIdMap = new Map<string, string>(); // externalId → cuid

  for (const [trimExtId, trim] of Object.entries(trims)) {
    const lineupCuid = trim.lineup ? lineupIdMap.get(trim.lineup) : null;
    const engineType = pickPrimaryEngine(trim.engine ?? modelDetail.engine ?? "G");
    const trimPrice = toInt(trim.price);

    // documents 누적 수집 (이 trim 의 items 및 itemsLink 체인)
    const docIds = [trim.items, ...splitCsv(trim.itemsLink)].filter(Boolean) as string[];
    const documents = docIds
      .map((id) => modelEntry.detail.document?.[id])
      .filter(Boolean);

    // 트림별 색상 가격맵 (modelLevel 와 별개)
    const trimColorExt = parseColorTsv(trim.colorExt);
    const trimColorInt = parseColorTsv(trim.colorInt);

    const trimDetailedSpecs = {
      carpanRaw: {
        ...trim,
        documents,
        colorPriceMap: { ext: trimColorExt, int: trimColorInt },
      },
    };

    const createdTrim = await prisma.trim.upsert({
      where: { externalId: trimExtId },
      create: {
        vehicleId: vehicle.id,
        lineupId: lineupCuid ?? undefined,
        name: trim.name ?? `trim-${trimExtId}`,
        price: trimPrice || 0,
        engineType,
        fuelEfficiency: pickRepresentativeEfficiency(modelDetail.efficiency),
        externalId: trimExtId,
        isVisible: isCurrentlySold(trim.state),
        specs: { lineup: trim.lineup, displace: trim.displace } as unknown as Prisma.InputJsonValue,
        detailedSpecs: trimDetailedSpecs as unknown as Prisma.InputJsonValue,
      },
      update: {
        vehicleId: vehicle.id,
        lineupId: lineupCuid ?? undefined,
        name: trim.name ?? `trim-${trimExtId}`,
        price: trimPrice || 0,
        engineType,
        isVisible: isCurrentlySold(trim.state),
        specs: { lineup: trim.lineup, displace: trim.displace } as unknown as Prisma.InputJsonValue,
        detailedSpecs: trimDetailedSpecs as unknown as Prisma.InputJsonValue,
      },
    });
    trimIdMap.set(trimExtId, createdTrim.id);
    stats.trims++;

    // 4) 이 trim 의 옵션들 (TSV 파싱)
    const optionRows = parseOptionTsv(trim.option);
    for (const opt of optionRows) {
      const optDetail = modelEntry.detail.option?.[opt.id];
      const { category: optCategory, isAccessory } = mapOptionKind(optDetail?.kind);
      const description = [optDetail?.apply, optDetail?.guide, optDetail?.package]
        .filter(Boolean)
        .join("\n\n");

      await prisma.trimOption.upsert({
        where: {
          trimId_externalId: {
            trimId: createdTrim.id,
            externalId: opt.id,
          },
        },
        create: {
          trimId: createdTrim.id,
          name: optDetail?.name ?? `option-${opt.id}`,
          price: opt.price,
          category: optCategory,
          isAccessory,
          description: description || null,
          externalId: opt.id,
          metadata: {
            kind: optDetail?.kind,
            condition: opt.condition,
            flag: opt.flag,
            extNot: optDetail?.extNot,
            intNot: optDetail?.intNot,
            extJoin: optDetail?.extJoin,
            intJoin: optDetail?.intJoin,
            packageRemark: optDetail?.packageRemark,
          } as unknown as Prisma.InputJsonValue,
        },
        update: {
          name: optDetail?.name ?? `option-${opt.id}`,
          price: opt.price,
          category: optCategory,
          isAccessory,
          description: description || null,
          metadata: {
            kind: optDetail?.kind,
            condition: opt.condition,
            flag: opt.flag,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      stats.options++;
    }
  }

  // 5) 색상 (외장 + 내장) — 모델 단위 1회만
  const colorExtRows = parseColorTsv(modelDetail.colorExt);
  const colorIntRows = parseColorTsv(modelDetail.colorInt);
  let sortOrder = 0;

  for (const row of colorExtRows) {
    const detail = modelEntry.detail.colorExt?.[row.id];
    if (!detail) continue;
    await prisma.vehicleColor.upsert({
      where: {
        vehicleId_kind_externalId: {
          vehicleId: vehicle.id,
          kind: "EXTERIOR",
          externalId: row.id,
        },
      },
      create: {
        vehicleId: vehicle.id,
        kind: "EXTERIOR",
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta: row.priceDelta,
        sortOrder: sortOrder++,
        externalId: row.id,
        mfgCode: detail.code,
        metadata: {
          rgb2: detail.rgb2,
          group: detail.group,
          optionJoin: detail.optionJoin,
          optionNot: detail.optionNot,
          intNot: detail.intNot,
        } as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta: row.priceDelta,
        mfgCode: detail.code,
      },
    });
    stats.colors++;
  }

  sortOrder = 0;
  for (const row of colorIntRows) {
    const detail = modelEntry.detail.colorInt?.[row.id];
    if (!detail) continue;
    await prisma.vehicleColor.upsert({
      where: {
        vehicleId_kind_externalId: {
          vehicleId: vehicle.id,
          kind: "INTERIOR",
          externalId: row.id,
        },
      },
      create: {
        vehicleId: vehicle.id,
        kind: "INTERIOR",
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta: row.priceDelta,
        sortOrder: sortOrder++,
        externalId: row.id,
        metadata: {
          rgb2: detail.rgb2,
          group: detail.group,
          optionJoin: detail.optionJoin,
          optionNot: detail.optionNot,
          extNot: detail.extNot,
        } as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta: row.priceDelta,
      },
    });
    stats.colors++;
  }

  console.log(
    `✓ ${modelId} ${name} — lineups ${Object.keys(lineups).length}, trims ${Object.keys(trims).length}, colors ${colorExtRows.length + colorIntRows.length}`
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
  console.log(`carpan import 시작 (dryRun=${args.dryRun}, files=${args.files.join(",")})`);

  for (const file of args.files) {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) {
      console.error(`파일 없음: ${fullPath}`);
      continue;
    }
    const raw = fs.readFileSync(fullPath, "utf-8");
    const data: CarpanFileFormat = JSON.parse(raw);

    console.log(`\n=== ${file} (${data.meta.modelCount} 모델) ===`);

    for (const [brandId, brand] of Object.entries(data.brands)) {
      if (args.brandFilter && brandId !== args.brandFilter) continue;

      for (const [modelId, model] of Object.entries(brand.models)) {
        if (args.modelFilter && modelId !== args.modelFilter) continue;

        try {
          await importModel(brand, { ...model, modelId }, args.dryRun);
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
