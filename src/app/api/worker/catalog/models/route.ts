import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { workerModelResultsSchema } from "@/lib/validations/admin";
import {
  canAcceptModelResults,
  getScrapeJobLeaseToken,
  isTerminalScrapeJobStatus,
} from "@/lib/scraper/job-state";

// POST /api/worker/catalog/models — models 잡이 가져온 브랜드 1개분 차량 목록을 저장.
// 목록은 스냅샷이라 해당 브랜드의 기존 행 중 이번에 안 온 차량은 지운다(단종 반영).
export async function POST(request: NextRequest) {
  const { error } = requireWorker(request);
  if (error) return error;

  try {
    const leaseToken = getScrapeJobLeaseToken(request);
    if (!leaseToken) {
      return NextResponse.json({ error: "작업 lease token이 필요합니다." }, { status: 400 });
    }
    const input = workerModelResultsSchema.parse(await request.json());
    const db = prisma;

    const job = await db.scrapeJob.findUnique({
      where: { id: input.jobId },
      select: { status: true, jobType: true, financeCompanyId: true, productType: true, params: true },
    });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });
    if (job.status === "canceled") {
      return NextResponse.json({ success: true, ignored: true });
    }
    if (
      isTerminalScrapeJobStatus(job.status) ||
      !canAcceptModelResults(job, {
        financeCompanyId: input.financeCompanyId,
        productType: input.productType,
        brandCds: [input.brandCd],
      })
    ) {
      return NextResponse.json({ error: "작업 컨텍스트 또는 상태가 일치하지 않습니다." }, { status: 409 });
    }

    const syncedAt = new Date();
    const stored = await db.$transaction(async (tx) => {
      const lease = await tx.scrapeJob.updateMany({
        where: {
          id: input.jobId,
          status: "running",
          jobType: "models",
          financeCompanyId: input.financeCompanyId,
          productType: input.productType,
          leaseToken,
        },
        data: { heartbeatAt: syncedAt },
      });
      if (lease.count !== 1) return false;

      for (const m of input.models) {
        const data = { brandName: input.brandName, modelName: m.modelName, syncedAt };
        await tx.capitalCatalogModel.upsert({
          where: {
            financeCompanyId_productType_brandCd_modelCd: {
              financeCompanyId: input.financeCompanyId,
              productType: input.productType,
              brandCd: input.brandCd,
              modelCd: m.modelCd,
            },
          },
          create: {
            financeCompanyId: input.financeCompanyId,
            productType: input.productType,
            brandCd: input.brandCd,
            modelCd: m.modelCd,
            ...data,
          },
          update: data,
        });
      }
      // 이번 목록에 없는 기존 차량 = 캐피탈사에서 내려간 차량 → 선택지에서 제거.
      // 단 빈 목록으로는 지우지 않는다 — 사이트 응답 이상으로 0건이 온 경우 멀쩡한 목록을
      // 통째로 날리는 쪽이 낡은 행이 남는 것보다 나쁘다.
      if (input.models.length > 0) {
        await tx.capitalCatalogModel.deleteMany({
          where: {
            financeCompanyId: input.financeCompanyId,
            productType: input.productType,
            brandCd: input.brandCd,
            modelCd: { notIn: input.models.map((m) => m.modelCd) },
          },
        });
      }
      return true;
    });
    if (!stored) {
      return NextResponse.json({ error: "작업 상태가 변경되었습니다." }, { status: 409 });
    }

    return NextResponse.json({ success: true, upserted: input.models.length });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다.", details: e.flatten() }, { status: 400 });
    }
    console.error("[worker catalog models]", e);
    return NextResponse.json({ error: "차량 목록 저장 실패" }, { status: 500 });
  }
}
