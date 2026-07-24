import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { scrapeJobCreateSchema } from "@/lib/validations/admin";

const IN_FLIGHT = ["pending", "running", "needs_human"];

// 우리 브랜드명 → ORIX 캐피탈 브랜드코드
const ORIX_BRAND_CD: Record<string, string> = {
  "현대": "CA100001", "기아": "CA100002", "제네시스": "CA100088",
  "쉐보레": "CA100045", "르노": "CA100004", "르노코리아": "CA100004", "KGM": "CA100005",
};

/** 차량의 브랜드+차량명으로 캐피탈사 차량 식별자를 자동 인식 (수동 연결이 없을 때). */
function deriveScraperRef(adapter: string, brand?: string | null, name?: string | null) {
  if (adapter === "ORIX" && brand && name) {
    const brandCd = ORIX_BRAND_CD[brand];
    if (brandCd) return { brandCd, modelName: name };
  }
  return undefined;
}

// POST /api/admin/scrape-jobs — 캐피탈사 회수율 수집 작업 생성
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const input = scrapeJobCreateSchema.parse(await request.json());
    const db = prisma as any;

    // 자격증명이 등록·활성화되어 있어야 함
    const cred = await db.capitalScraperCredential.findUnique({
      where: { financeCompanyId: input.financeCompanyId },
    });
    if (!cred || !cred.isActive) {
      return NextResponse.json(
        { error: "해당 캐피탈사의 로그인 자격증명을 먼저 등록하세요." },
        { status: 400 }
      );
    }

    // 동일 캐피탈사에 진행 중인 작업이 있으면 중복 세션 방지
    const inFlight = await db.scrapeJob.findFirst({
      where: { financeCompanyId: input.financeCompanyId, status: { in: IN_FLIGHT } },
    });
    if (inFlight) {
      return NextResponse.json(
        { error: "이미 진행 중인 수집 작업이 있습니다.", jobId: inFlight.id },
        { status: 409 }
      );
    }

    // 워커 이름매칭용: 차량의 캐피탈사 연결(scraperRefs) + 트림명을 params 에 주입
    // 어댑터 코드: config.adapter 명시 → 없으면 로그인 URL 로 자동 인식(orix → ORIX) → PILOT
    const loginUrlLc = typeof cred.loginUrl === "string" ? cred.loginUrl.toLowerCase() : "";
    const adapterCode = (cred.config?.adapter as string)
      || (loginUrlLc.includes("orix") ? "ORIX" : "PILOT");
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: { brand: true, name: true, scraperRefs: true, trims: { where: { id: { in: input.trimIds } }, select: { id: true, name: true } } },
    });
    // 캐피탈사 차량 연결: 수동 override(scraperRefs) 우선, 없으면 브랜드+차량명으로 자동 인식
    const manualRef = (vehicle?.scraperRefs as Record<string, { brandCd: string; modelName: string }> | null)?.[adapterCode];
    const scraperRef = manualRef ?? deriveScraperRef(adapterCode, vehicle?.brand, vehicle?.name);
    const trimNames = (vehicle?.trims ?? []).map((t) => ({ trimId: t.id, name: t.name }));

    const job = await db.scrapeJob.create({
      data: {
        financeCompanyId: input.financeCompanyId,
        status: "pending",
        productType: input.productType,
        params: {
          trimIds: input.trimIds,
          vehicleId: input.vehicleId,
          lineupIds: input.lineupIds,
          weekOf: input.weekOf,
          minVehiclePrice: input.minVehiclePrice,
          maxVehiclePrice: input.maxVehiclePrice,
          ...(scraperRef ? { scraperRef } : {}),
          trims: trimNames,
        },
        createdById: session.id,
      },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "SCRAPE_JOB_CREATE",
      resource: "ScrapeJob",
      targetId: job.id,
      meta: {
        financeCompanyId: input.financeCompanyId,
        productType: input.productType,
        trimCount: input.trimIds.length,
      },
    });

    return NextResponse.json({ success: true, jobId: job.id, status: job.status });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[scrape-jobs POST]", e);
    return NextResponse.json({ error: "작업 생성 실패" }, { status: 500 });
  }
}
