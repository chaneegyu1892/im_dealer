import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { workerJobResultSchema } from "@/lib/validations/admin";
import { isTerminalScrapeJobStatus } from "@/lib/scraper/job-state";

const ACTIVE_STATUSES = ["running", "needs_human"];

// POST /api/worker/scrape-jobs/[id]/result — 워커가 수집 결과(초안) 또는 실패를 보고
// 워커는 저장 API 를 직접 호출하지 않는다. 확정(반영)은 어드민이 브라우저에서 수행.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireWorker(request);
  if (error) return error;

  try {
    const { id } = await params;
    const result = workerJobResultSchema.parse(await request.json());
    const db = prisma;

    const job = await db.scrapeJob.findUnique({ where: { id }, select: { status: true, financeCompanyId: true, jobType: true } });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });
    if (isTerminalScrapeJobStatus(job.status)) {
      return NextResponse.json({ success: true, ignored: true });
    }
    if (!ACTIVE_STATUSES.includes(job.status)) {
      return NextResponse.json({ error: "실행 중인 작업이 아닙니다." }, { status: 409 });
    }

    let updatedCount = 0;
    if (result.ok) {
      // jobType 별 페이로드: trim_rates 는 draft, catalog 는 catalogSummary (draft 컬럼에 저장)
      const payload = job.jobType === "catalog" ? result.catalogSummary : result.draft;
      if (!payload) {
        return NextResponse.json(
          { error: job.jobType === "catalog" ? "catalogSummary 가 필요합니다." : "draft 가 필요합니다." },
          { status: 400 }
        );
      }
      // 완료 — 임시 로그인 정보 폐기
      const updated = await db.scrapeJob.updateMany({
        where: { id, status: { in: ACTIVE_STATUSES } },
        data: {
          status: "completed",
          draft: payload,
          error: null,
          finishedAt: new Date(),
          credUsernameEnc: null,
          credPasswordEnc: null,
        },
      });
      updatedCount = updated.count;
    } else {
      // 실패 — 임시 로그인 정보 폐기
      const updated = await db.scrapeJob.updateMany({
        where: { id, status: { in: ACTIVE_STATUSES } },
        data: {
          status: "failed",
          error: result.error,
          finishedAt: new Date(),
          credUsernameEnc: null,
          credPasswordEnc: null,
        },
      });
      updatedCount = updated.count;
      // 로그인 인증 실패 시 관리자 알림(입력한 개인 계정의 ID/PW 확인 유도).
      if (updatedCount === 1 && result.authFailed && job.financeCompanyId) {
        const fc = await db.financeCompany
          .findUnique({ where: { id: job.financeCompanyId }, select: { name: true } })
          .catch(() => null);
        const name = fc?.name ?? job.financeCompanyId;
        await db.adminNotification
          .create({
            data: {
              type: "SYSTEM",
              title: `[${name}] 스크래퍼 로그인 실패`,
              content: `입력한 로그인 정보로 인증에 실패했습니다. ID/PW 를 확인 후 다시 시도하세요. 사유: ${result.error.slice(0, 120)}`,
              linkUrl: "/admin/finance",
            },
          })
          .catch(() => null);
      }
    }

    if (updatedCount !== 1) {
      return NextResponse.json({ success: true, ignored: true });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[worker result]", e);
    return NextResponse.json({ error: "결과 저장 실패" }, { status: 500 });
  }
}
