import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { workerCatalogResultsSchema } from "@/lib/validations/admin";
import { RATE_KEYS } from "@/lib/quote-calculator";
import { canAcceptCatalogResults, isTerminalScrapeJobStatus } from "@/lib/scraper/job-state";

// POST /api/worker/catalog/results — catalog 잡의 증분 결과(모델 단위 flush)를 upsert.
// 몇 시간짜리 잡이 중간에 죽어도 이미 저장된 트림은 유효하며, 재클레임 시 collected 로 스킵된다.
export async function POST(request: NextRequest) {
  const { error } = requireWorker(request);
  if (error) return error;

  try {
    const input = workerCatalogResultsSchema.parse(await request.json());
    const db = prisma;

    const job = await db.scrapeJob.findUnique({
      where: { id: input.jobId },
      select: { status: true, jobType: true, financeCompanyId: true, productType: true },
    });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });
    if (job.status === "canceled") {
      return NextResponse.json({ success: true, ignored: true });
    }
    if (
      isTerminalScrapeJobStatus(job.status) ||
      !canAcceptCatalogResults(job, input)
    ) {
      return NextResponse.json({ error: "작업 컨텍스트 또는 상태가 일치하지 않습니다." }, { status: 409 });
    }

    const weekOf = new Date(input.weekOf);
    const scrapedAt = new Date();
    const stored = await db.$transaction(async (tx) => {
      const lease = await tx.scrapeJob.updateMany({
        where: {
          id: input.jobId,
          status: "running",
          jobType: "catalog",
          financeCompanyId: input.financeCompanyId,
          productType: input.productType,
        },
        data: { heartbeatAt: scrapedAt },
      });
      if (lease.count !== 1) return false;
      await Promise.all(input.entries.map((e: (typeof input.entries)[number]) => {
        // baseRates 는 RATE_KEYS 9칸으로 정규화 (0 = 미산출)
        const baseRates = Object.fromEntries(RATE_KEYS.map((k) => [k, e.baseRates[k] ?? 0]));
        const data = {
          brandCd: e.brandCd,
          brandName: e.brandName,
          modelCd: e.modelCd,
          modelName: e.modelName,
          dtMdlCd: e.dtMdlCd,
          dtMdlName: e.dtMdlName ?? null,
          trimName: e.trimName,
          modelYear: e.modelYear ?? null,
          vehiclePrice: e.vehiclePrice,
          baseRates,
          depositRate36_10000: e.depositRate36_10000 ?? null,
          prepayRate36_10000: e.prepayRate36_10000 ?? null,
          warnings: e.warnings.length ? e.warnings : undefined,
          weekOf,
          scrapedAt,
        };
        return tx.capitalCatalogTrim.upsert({
          where: {
            financeCompanyId_productType_mdelCd: {
              financeCompanyId: input.financeCompanyId,
              productType: input.productType,
              mdelCd: e.mdelCd,
            },
          },
          create: { financeCompanyId: input.financeCompanyId, productType: input.productType, mdelCd: e.mdelCd, ...data },
          update: data,
        });
      }));
      return true;
    });
    if (!stored) {
      return NextResponse.json({ error: "작업 상태가 변경되었습니다." }, { status: 409 });
    }

    return NextResponse.json({ success: true, upserted: input.entries.length });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다.", details: e.flatten() }, { status: 400 });
    }
    console.error("[worker catalog results]", e);
    return NextResponse.json({ error: "카탈로그 저장 실패" }, { status: 500 });
  }
}
