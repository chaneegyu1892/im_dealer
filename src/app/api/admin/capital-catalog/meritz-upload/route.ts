import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import {
  ingestMeritzRent,
  type OurVehicle,
  type MeritzIngestResult,
  type MeritzCatalogEntry,
  type MappedPriceByMdelCd,
} from "@/lib/scraper/meritz/ingest";
import { ingestMeritzLease } from "@/lib/scraper/meritz/lease-ingest";
import { ingestMeritzImportRent } from "@/lib/scraper/meritz/import-rent-ingest";
import { detectMeritzRentVariant } from "@/lib/scraper/meritz/import-rent-parse";
import { ingestMeritzImportLease } from "@/lib/scraper/meritz/import-lease-ingest";
import { detectMeritzLeaseVariant } from "@/lib/scraper/meritz/import-lease-parse";
import { ingestMgRent } from "@/lib/scraper/mg/ingest";
import { ingestMgImportLease } from "@/lib/scraper/mg/import-ingest";
import { detectMgQuoteVariant } from "@/lib/scraper/mg/import-parse";
import { ingestMgImportFinance } from "@/lib/scraper/mg/import-finance-ingest";
import { ingestMeritzImportFinance } from "@/lib/scraper/meritz/import-finance-ingest";
import { excelCapitalKind, type ExcelCapitalKind } from "@/lib/scraper/excel-capitals";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 이번 주 월요일(KST) 0시. */
function weekMonday(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const day = kst.getUTCDay(); // 0=일
  const diff = (day === 0 ? -6 : 1) - day;
  const mon = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + diff));
  return new Date(mon.getTime() - 9 * 3600 * 1000);
}

/** 업로드한 파일 하나로 저장할 상품 하나. */
type UploadTarget = {
  productType: string;
  run: (vehicles: OurVehicle[], mapped: MappedPriceByMdelCd) => MeritzIngestResult;
};

type UploadResult =
  | ({ productType: string; saved: number } & MeritzIngestResult["summary"])
  | { productType: string; error: string };

/** 워크북 시트 구성으로 저장 대상 상품을 판별한다. 수입견적 파일에는 운용리스·금융리스·할부가
 *  같은 워크북에 들어 있어 업로드 1회로 셋 다 저장한다(상품 유형을 고를 필요 없음). */
function resolveUploadTargets(kind: ExcelCapitalKind, buf: Buffer): UploadTarget[] {
  const targets: UploadTarget[] = [];

  if (kind === "mg") {
    const variant = detectMgQuoteVariant(buf);
    if (variant === "rent") {
      targets.push({ productType: "장기렌트", run: (v, m) => ingestMgRent(buf, v, m) });
    } else if (variant === "importLease") {
      targets.push(
        { productType: "리스", run: (v, m) => ingestMgImportLease(buf, v, m) },
        { productType: "금융리스", run: (v, m) => ingestMgImportFinance(buf, v, "금융리스", m) },
        { productType: "할부", run: (v, m) => ingestMgImportFinance(buf, v, "할부", m) },
      );
    }
    return targets;
  }

  const rentVariant = detectMeritzRentVariant(buf);
  if (rentVariant === "domestic") {
    targets.push({ productType: "장기렌트", run: (v, m) => ingestMeritzRent(buf, v, m) });
  } else if (rentVariant === "import") {
    targets.push({ productType: "장기렌트", run: (v, m) => ingestMeritzImportRent(buf, v, m) });
  }

  const leaseVariant = detectMeritzLeaseVariant(buf);
  if (leaseVariant === "domestic") {
    targets.push({ productType: "리스", run: (v, m) => ingestMeritzLease(buf, v, m) });
  } else if (leaseVariant === "import") {
    targets.push(
      { productType: "리스", run: (v, m) => ingestMeritzImportLease(buf, v, m) },
      { productType: "금융리스", run: (v, m) => ingestMeritzImportFinance(buf, v, "금융리스", m) },
      { productType: "할부", run: (v, m) => ingestMeritzImportFinance(buf, v, "할부", m) },
    );
  }
  return targets;
}

// 행 단위 upsert 는 왕복이 트림 수만큼 생겨 상품 3개를 저장하면 maxDuration 을 넘긴다(MG 수입 657트림×3 ≈ 70초).
// 다중 행 INSERT ... ON CONFLICT 로 묶어 상품당 왕복을 몇 번으로 줄인다.
const UPSERT_CHUNK = 200;

const CATALOG_UPDATE_COLUMNS = [
  "brandCd", "brandName", "modelCd", "modelName", "dtMdlCd", "dtMdlName", "trimName",
  "vehiclePrice", "baseRates", "warnings", "residualRates",
  "depositRate36_10000", "prepayRate36_10000", "weekOf", "scrapedAt", "updatedAt",
] as const;

/** 카탈로그 배치 upsert (mdelCd 단위) → 저장 건수. */
async function saveEntries(
  financeCompanyId: string, productType: string, entries: MeritzCatalogEntry[], weekOf: Date, scrapedAt: Date
): Promise<number> {
  const setClause = Prisma.join(
    CATALOG_UPDATE_COLUMNS.map((c) => Prisma.raw(`"${c}" = EXCLUDED."${c}"`)),
    ", "
  );

  // 견적기에 같은 트림코드가 여러 번 나오는 파일이 있다(메리츠 수입신차). 한 INSERT 안에 중복 키가 있으면
  // ON CONFLICT 가 에러를 내므로 미리 접는다 — 뒤에 나온 행이 이김(행 단위 upsert 때와 동일).
  const deduped = [...new Map(entries.map((e) => [e.mdelCd, e])).values()];

  for (let i = 0; i < deduped.length; i += UPSERT_CHUNK) {
    const values = deduped.slice(i, i + UPSERT_CHUNK).map((e) => Prisma.sql`(
      ${randomUUID()}, ${financeCompanyId}, ${productType},
      ${e.brandCd}, ${e.brandName}, ${e.modelCd}, ${e.modelName},
      ${e.dtMdlCd}, ${e.dtMdlName ?? null}::text, ${e.mdelCd}, ${e.trimName}, ${e.vehiclePrice},
      ${JSON.stringify(e.baseRates)}::jsonb,
      ${e.warnings.length ? JSON.stringify(e.warnings) : null}::jsonb,
      ${e.residualRates ? JSON.stringify(e.residualRates) : null}::jsonb,
      ${e.depositRate36_10000 ?? null}::integer, ${e.prepayRate36_10000 ?? null}::integer,
      ${weekOf}, ${scrapedAt}, ${scrapedAt}
    )`);

    await prisma.$executeRaw`
      INSERT INTO "CapitalCatalogTrim" (
        "id", "financeCompanyId", "productType",
        "brandCd", "brandName", "modelCd", "modelName",
        "dtMdlCd", "dtMdlName", "mdelCd", "trimName", "vehiclePrice",
        "baseRates",
        -- warnings·residualRates 는 빈 값이면 NULL — update 시 이전 경고(폴백 등)가 남으면 apply-catalog 가 계속 차단함
        "warnings",
        "residualRates",
        "depositRate36_10000", "prepayRate36_10000",
        "weekOf", "scrapedAt", "updatedAt"
      )
      VALUES ${Prisma.join(values, ", ")}
      ON CONFLICT ("financeCompanyId", "productType", "mdelCd") DO UPDATE SET ${setClause}
    `;
  }
  return deduped.length;
}

// POST /api/admin/capital-catalog/meritz-upload — 엑셀 견적기 업로드 → 파싱·매칭·산출 → 카탈로그 저장.
// 파일의 시트 구성으로 상품을 판별하므로 수입견적 파일은 한 번 올리면 운용리스·금융리스·할부가 함께 저장된다.
export async function POST(request: NextRequest) {
  const { admin, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const financeCompanyId = String(form.get("financeCompanyId") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ error: "파일(.xlsm)이 필요합니다." }, { status: 400 });
    if (!financeCompanyId) return NextResponse.json({ error: "캐피탈사를 선택하세요." }, { status: 400 });
    // xls/xlsm/xlsx 허용 — MG 수입견적은 .xlsx 배포라 기존 /\.xlsm?$/ 로는 거부되던 것 수정
    if (!/\.xls[mx]?$/i.test(file.name)) return NextResponse.json({ error: "엑셀(.xlsm/.xlsx) 파일만 지원합니다." }, { status: 400 });

    // 캐피탈사 종류로 파서/계산기 디스패치
    const fc = await prisma.financeCompany.findUnique({ where: { id: financeCompanyId }, select: { name: true } });
    const kind = fc ? excelCapitalKind(fc.name) : null;
    if (!fc || !kind) {
      return NextResponse.json({ error: "이 캐피탈사는 엑셀 업로드를 지원하지 않습니다." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const targets = resolveUploadTargets(kind, buf);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: "지원하는 견적기 파일이 아닙니다. 시트 구성을 확인하세요 (MG: 차량_List / 차량DB+운용리스, 메리츠: 렌트_입력시트 · 렌트_입력 · 차량정보+리스수식 · 차종+운용리스 입력)." },
        { status: 400 }
      );
    }

    // 우리 DB 차량+트림(가격) — 이름매칭용
    const vs = await prisma.vehicle.findMany({
      select: { id: true, brand: true, name: true, trims: { where: { lineupId: { not: null } }, select: { id: true, name: true, price: true, lineup: { select: { name: true } } } } },
    });
    const ourVehicles: OurVehicle[] = vs.map((v) => ({
      id: v.id, brand: v.brand, name: v.name,
      trims: v.trims.map((t) => ({ id: t.id, name: t.name, price: t.price, lineupName: t.lineup?.name ?? null })),
    }));

    // 확정 매핑(관리자 검수) → 엑셀 트림코드별 우리 트림 가격. 이름 매칭보다 우선 주입.
    // 매핑은 상품 유형별로 따로 확정되므로 대상 상품별로 나눠 담는다.
    // updatedAt asc 순회 후 덮어쓰기 — 같은 카탈로그 트림에 복수 매핑 시 최신 매핑이 이김.
    const productTypes = targets.map((t) => t.productType);
    const confirmedMappings = await prisma.capitalTrimMapping.findMany({
      where: { financeCompanyId, productType: { in: productTypes } },
      orderBy: { updatedAt: "asc" },
      select: { productType: true, catalogTrim: { select: { mdelCd: true } }, trimId: true, trim: { select: { price: true } } },
    });
    const mappedByProduct = new Map<string, MappedPriceByMdelCd>(productTypes.map((p) => [p, new Map()]));
    for (const m of confirmedMappings) {
      mappedByProduct.get(m.productType)?.set(m.catalogTrim.mdelCd, { trimId: m.trimId, price: m.trim.price });
    }

    // ── 미리보기 모드: 저장 없이 파일 안의 차량(모델) 목록만 돌려준다 — 골라서 가져오기용 ──
    if (String(form.get("mode") ?? "") === "preview") {
      const products: { productType: string; models: { modelName: string; trims: number }[] }[] = [];
      for (const target of targets) {
        try {
          const r = target.run(ourVehicles, mappedByProduct.get(target.productType) ?? new Map());
          const counts = new Map<string, number>();
          for (const e of r.entries) counts.set(e.modelName, (counts.get(e.modelName) ?? 0) + 1);
          products.push({
            productType: target.productType,
            models: [...counts]
              .map(([modelName, trims]) => ({ modelName, trims }))
              .sort((a, b) => a.modelName.localeCompare(b.modelName, "ko")),
          });
        } catch {
          products.push({ productType: target.productType, models: [] });
        }
      }
      return NextResponse.json({ success: true, preview: true, products });
    }

    // 선택 저장: models(모델명 JSON 배열)가 오면 그 차량만 저장한다. 없으면 전체(기존 동작).
    let selectedModels: Set<string> | null = null;
    const modelsRaw = form.get("models");
    if (typeof modelsRaw === "string" && modelsRaw) {
      try {
        const arr: unknown = JSON.parse(modelsRaw);
        if (Array.isArray(arr) && arr.length > 0) selectedModels = new Set(arr.map(String));
      } catch {
        return NextResponse.json({ error: "models 형식이 올바르지 않습니다." }, { status: 400 });
      }
    }

    const weekOf = weekMonday();
    const scrapedAt = new Date();

    // 상품 하나가 실패해도(예: 금리 입력 셀 이상) 나머지는 저장하고, 실패 사유는 결과에 담아 알린다.
    const results: UploadResult[] = [];
    for (const target of targets) {
      try {
        const r = target.run(ourVehicles, mappedByProduct.get(target.productType) ?? new Map());
        const entries = selectedModels ? r.entries.filter((e) => selectedModels.has(e.modelName)) : r.entries;
        const saved = await saveEntries(financeCompanyId, target.productType, entries, weekOf, scrapedAt);
        results.push({
          productType: target.productType,
          ...r.summary,
          unmatchedNames: r.summary.unmatchedNames.slice(0, 50),
          fallbackNames: r.summary.fallbackNames.slice(0, 50),
          saved,
        });
      } catch (e) {
        // 파서 내부 경로·노드 정보가 응답에 실리지 않도록 원문은 서버 로그로만.
        console.error(`[meritz-upload] ${target.productType} 처리 실패:`, e instanceof Error ? e.message : e);
        results.push({ productType: target.productType, error: "엑셀 처리에 실패했습니다. 파일 형식을 확인해 주세요." });
      }
    }

    const errors = results.filter((r): r is { productType: string; error: string } => "error" in r);
    if (errors.length === results.length) {
      return NextResponse.json({ error: `엑셀 처리 실패: ${errors[0].error}` }, { status: 400 });
    }

    // 카탈로그 금리 일괄 교체는 민감 변경 — apply-catalog 와 동일 액션으로 추적.
    await logAdminAction({
      request,
      actor: admin,
      action: "RATE_SHEET_APPLY_CATALOG",
      resource: "CapitalCatalogTrim",
      meta: {
        financeCompanyId,
        financeCompanyName: fc.name,
        weekOf: weekOf.toISOString(),
        products: results.map((r) =>
          "error" in r
            ? { productType: r.productType, error: r.error }
            : { productType: r.productType, saved: r.saved, total: r.total, unmatched: r.unmatched }
        ),
      },
    });

    return NextResponse.json({ success: true, weekOf: weekOf.toISOString(), results });
  } catch (e) {
    console.error("[meritz-upload POST]", e);
    return NextResponse.json({ error: "업로드 처리 실패" }, { status: 500 });
  }
}
