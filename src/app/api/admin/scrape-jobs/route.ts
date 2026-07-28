import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { encryptString } from "@/lib/pii";
import { resolveCapitalConnection } from "@/lib/scraper/connections";
import { ORIX_BRAND_CD } from "@/lib/scraper/orix-brands";
import {
  catalogJobCreateSchema,
  scrapeJobCreateSchema,
  scraperRefsSchema,
} from "@/lib/validations/admin";

const IN_FLIGHT = ["pending", "running", "needs_human"];

/** 차량의 브랜드+차량명으로 캐피탈사 차량 식별자를 자동 인식 (수동 연결이 없을 때). */
function deriveScraperRef(adapter: string, brand?: string | null, name?: string | null) {
  if (adapter === "ORIX" && brand && name) {
    const brandCd = ORIX_BRAND_CD[brand];
    if (brandCd) return { brandCd, modelName: name };
  }
  return undefined;
}

// POST /api/admin/scrape-jobs — 캐피탈사 회수율 수집 작업 생성
// body.jobType === "catalog" 면 브랜드 전량 수집 잡, 아니면 기존 차량·트림 지정 수집 잡.
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const raw: unknown = await request.json();
    const catalogProbe = z.object({ jobType: z.literal("catalog") }).safeParse(raw);
    const input = catalogProbe.success ? null : scrapeJobCreateSchema.parse(raw);
    const catalogInput = catalogProbe.success ? catalogJobCreateSchema.parse(raw) : null;
    const financeCompanyId = catalogInput?.financeCompanyId ?? input?.financeCompanyId;
    if (!financeCompanyId) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
    }
    const db = prisma;

    // 캐피탈사 접속 설정(로그인 URL·어댑터)은 코드에 내장 — 지원 대상만 허용
    const fc = await prisma.financeCompany.findUnique({
      where: { id: financeCompanyId },
      select: { name: true },
    });
    const connection = fc ? resolveCapitalConnection(fc.name) : null;
    if (!connection) {
      return NextResponse.json(
        { error: "스크래핑을 지원하지 않는 캐피탈사입니다." },
        { status: 400 }
      );
    }

    // 자격증명은 어댑터가 실제로 쓰는 캐피탈사(ORIX 등)에만 필요하다.
    // 키패드·SMS 를 쓰는 곳(requiresHuman)은 워커가 사람에게 로그인을 넘기므로
    // 받아봐야 쓰이지 않고 폐기된다 — 아예 받지 않고 저장도 하지 않는다.
    const username = catalogInput?.username ?? input?.username;
    const password = catalogInput?.password ?? input?.password;
    if (!connection.requiresHuman && (!username?.trim() || !password?.trim())) {
      return NextResponse.json(
        { error: "이 캐피탈사는 로그인 ID·비밀번호가 필요합니다." },
        { status: 400 }
      );
    }
    const credUsernameEnc = connection.requiresHuman ? null : encryptString(username ?? "");
    const credPasswordEnc = connection.requiresHuman ? null : encryptString(password ?? "");

    // 동일 캐피탈사에 진행 중인 작업이 있으면 중복 세션 방지
    const inFlight = await db.scrapeJob.findFirst({
      where: { financeCompanyId, status: { in: IN_FLIGHT } },
    });
    if (inFlight) {
      return NextResponse.json(
        { error: "이미 진행 중인 수집 작업이 있습니다.", jobId: inFlight.id },
        { status: 409 }
      );
    }

    // ── catalog 잡: 차량 조회 없이 브랜드 목록만 params 로 전달 ──
    if (catalogInput) {
      const job = await db.scrapeJob.create({
        data: {
          financeCompanyId,
          jobType: "catalog",
          status: "pending",
          productType: catalogInput.productType,
          credUsernameEnc,
          credPasswordEnc,
          params: {
            mode: "catalog",
            brands: catalogInput.brands,
            weekOf: catalogInput.weekOf,
            productType: catalogInput.productType,
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
        meta: { financeCompanyId, jobType: "catalog", brandCount: catalogInput.brands.length },
      });
      return NextResponse.json({ success: true, jobId: job.id, status: job.status });
    }

    // ── trim_rates 잡 (기존 흐름) ──
    if (!input) return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });

    // 워커 이름매칭용: 차량의 캐피탈사 연결(scraperRefs) + 트림명을 params 에 주입
    const adapterCode = connection.adapter;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: {
        brand: true,
        name: true,
        scraperRefs: true,
        trims: {
          where: { id: { in: input.trimIds } },
          select: { id: true, name: true, lineup: { select: { name: true } } },
        },
      },
    });
    // 캐피탈사 차량 연결: 수동 override(scraperRefs) 우선, 없으면 브랜드+차량명으로 자동 인식
    const parsedRefs = scraperRefsSchema.safeParse(vehicle?.scraperRefs);
    const manualRef = parsedRefs.success ? parsedRefs.data[adapterCode] : undefined;
    const scraperRef = manualRef ?? deriveScraperRef(adapterCode, vehicle?.brand, vehicle?.name);
    // 매칭 토큰(연식·연료·배기량)이 라인업명에, 구동계가 트림명에 나뉘어 있으므로 합쳐서 전달한다.
    const trimNames = (vehicle?.trims ?? []).map((t) => ({
      trimId: t.id,
      name: `${t.lineup?.name ?? ""} ${t.name}`.trim(),
    }));

    const job = await db.scrapeJob.create({
      data: {
        financeCompanyId: input.financeCompanyId,
        status: "pending",
        productType: input.productType,
        // 입력한 개인 로그인 — 암호화해 이 작업에만 임시 저장, 종료 시 폐기
        credUsernameEnc,
        credPasswordEnc,
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
