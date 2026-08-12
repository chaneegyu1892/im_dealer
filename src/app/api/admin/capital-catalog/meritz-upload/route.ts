import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { ingestMeritzRent, type OurVehicle, type MeritzIngestResult, type MappedPriceByMdelCd } from "@/lib/scraper/meritz/ingest";
import { ingestMeritzLease } from "@/lib/scraper/meritz/lease-ingest";
import { ingestMeritzImportRent } from "@/lib/scraper/meritz/import-rent-ingest";
import { detectMeritzRentVariant } from "@/lib/scraper/meritz/import-rent-parse";
import { ingestMgRent } from "@/lib/scraper/mg/ingest";
import { excelCapitalKind, excelUploadSupported } from "@/lib/scraper/excel-capitals";

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

// POST /api/admin/capital-catalog/meritz-upload — 메리츠 렌터카 견적기 .xlsm 업로드 → 파싱·매칭·산출 → 카탈로그 저장.
export async function POST(request: NextRequest) {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const financeCompanyId = String(form.get("financeCompanyId") ?? "");
    const productType = String(form.get("productType") ?? "장기렌트");
    if (!(file instanceof File)) return NextResponse.json({ error: "파일(.xlsm)이 필요합니다." }, { status: 400 });
    if (!financeCompanyId) return NextResponse.json({ error: "캐피탈사를 선택하세요." }, { status: 400 });
    if (!/\.xlsm?$/i.test(file.name)) return NextResponse.json({ error: "엑셀(.xlsm/.xlsx) 파일만 지원합니다." }, { status: 400 });

    // 캐피탈사 종류로 파서/계산기 디스패치
    const fc = await prisma.financeCompany.findUnique({ where: { id: financeCompanyId }, select: { name: true } });
    const kind = fc ? excelCapitalKind(fc.name) : null;
    if (!kind || !fc || !excelUploadSupported(fc.name, productType)) {
      return NextResponse.json({ error: "이 캐피탈사·상품 유형은 엑셀 업로드를 지원하지 않습니다." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // 우리 DB 차량+트림(가격) — 이름매칭용
    const vs = await prisma.vehicle.findMany({
      select: { id: true, brand: true, name: true, trims: { where: { lineupId: { not: null } }, select: { id: true, name: true, price: true, lineup: { select: { name: true } } } } },
    });
    const ourVehicles: OurVehicle[] = vs.map((v) => ({
      id: v.id, brand: v.brand, name: v.name,
      trims: v.trims.map((t) => ({ id: t.id, name: t.name, price: t.price, lineupName: t.lineup?.name ?? null })),
    }));

    // 확정 매핑(관리자 검수) → 엑셀 트림코드별 우리 트림 가격. 이름 매칭보다 우선 주입.
    // updatedAt asc 순회 후 덮어쓰기 — 같은 카탈로그 트림에 복수 매핑 시 최신 매핑이 이김.
    const confirmedMappings = await prisma.capitalTrimMapping.findMany({
      where: { financeCompanyId, productType },
      orderBy: { updatedAt: "asc" },
      select: { catalogTrim: { select: { mdelCd: true } }, trimId: true, trim: { select: { price: true } } },
    });
    const mappedPrices: MappedPriceByMdelCd = new Map();
    for (const m of confirmedMappings) {
      mappedPrices.set(m.catalogTrim.mdelCd, { trimId: m.trimId, price: m.trim.price });
    }

    let result: MeritzIngestResult;
    try {
      if (kind === "mg") result = ingestMgRent(buf, ourVehicles, mappedPrices);
      else if (productType === "리스") result = ingestMeritzLease(buf, ourVehicles, mappedPrices);
      else {
        // 메리츠 장기렌트: 국산(렌트_입력시트)/수입차(렌트_입력) 파일을 시트 구성으로 자동 판별
        const variant = detectMeritzRentVariant(buf);
        result =
          variant === "import"
            ? ingestMeritzImportRent(buf, ourVehicles, mappedPrices)
            : ingestMeritzRent(buf, ourVehicles, mappedPrices);
      }
    } catch (e) {
      return NextResponse.json({ error: `엑셀 파싱 실패: ${(e as Error).message}` }, { status: 400 });
    }

    const weekOf = weekMonday();
    const scrapedAt = new Date();
    const db = prisma;

    // 배치 upsert (mdelCd 단위)
    let saved = 0;
    for (const e of result.entries) {
      const data = {
        brandCd: e.brandCd, brandName: e.brandName, modelCd: e.modelCd, modelName: e.modelName,
        dtMdlCd: e.dtMdlCd, dtMdlName: e.dtMdlName ?? null, trimName: e.trimName,
        // warnings 는 undefined 대신 DbNull 로 비움 — update 시 이전 경고(폴백 등) 잔존하면 apply-catalog 가 계속 차단함
        vehiclePrice: e.vehiclePrice, baseRates: e.baseRates, warnings: e.warnings.length ? e.warnings : Prisma.DbNull,
        residualRates: e.residualRates ?? Prisma.DbNull, // 잔가율 보존(검증·재계산용)
        // 보증금10%·선납금10% 샘플 — 재업로드 시 이전 값 잔존 방지 위해 null 도 명시 기록
        depositRate36_10000: e.depositRate36_10000 ?? null,
        prepayRate36_10000: e.prepayRate36_10000 ?? null,
        weekOf, scrapedAt,
      };
      await db.capitalCatalogTrim.upsert({
        where: { financeCompanyId_productType_mdelCd: { financeCompanyId, productType, mdelCd: e.mdelCd } },
        create: { financeCompanyId, productType, mdelCd: e.mdelCd, ...data },
        update: data,
      });
      saved++;
    }

    return NextResponse.json({
      success: true,
      summary: {
        ...result.summary,
        unmatchedNames: result.summary.unmatchedNames.slice(0, 50),
        fallbackNames: result.summary.fallbackNames.slice(0, 50),
        saved,
        weekOf: weekOf.toISOString(),
      },
    });
  } catch (e) {
    console.error("[meritz-upload POST]", e);
    return NextResponse.json({ error: "업로드 처리 실패" }, { status: 500 });
  }
}
