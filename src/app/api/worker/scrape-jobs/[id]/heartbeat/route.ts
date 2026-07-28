import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { workerHeartbeatSchema } from "@/lib/validations/admin";
import { isTerminalScrapeJobStatus } from "@/lib/scraper/job-state";
import { markWorkerSeen } from "@/lib/scraper/worker-presence";

const ACTIVE_STATUSES = ["running", "needs_human"];

// POST /api/worker/scrape-jobs/[id]/heartbeat
// 워커 생존 신호 갱신 + 선택적 needs_human 전환. 응답에 현재 status 를 실어
// 워커가 어드민의 cancel/resume 을 인지하게 한다.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireWorker(request);
  if (error) return error;

  // 작업 실행 중에는 claim 을 호출하지 않으므로 여기서도 생존 신호를 남긴다.
  void markWorkerSeen().catch(() => undefined);

  try {
    const { id } = await params;
    const body = workerHeartbeatSchema.parse(await request.json().catch(() => ({})));
    const db = prisma;

    const job = await db.scrapeJob.findUnique({ where: { id }, select: { status: true } });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });

    if (isTerminalScrapeJobStatus(job.status)) {
      return NextResponse.json({ status: job.status, ignored: true });
    }
    if (!ACTIVE_STATUSES.includes(job.status)) {
      return NextResponse.json({ error: "실행 중인 작업이 아닙니다." }, { status: 409 });
    }

    const data: Record<string, unknown> = { heartbeatAt: new Date() };
    if (body.status === "needs_human") {
      data.status = "needs_human";
      if (body.humanPrompt !== undefined) data.humanPrompt = body.humanPrompt;
    }
    if (body.progress !== undefined) data.progress = body.progress; // catalog 잡 진행률

    const updated = await db.scrapeJob.updateMany({
      where: { id, status: { in: ACTIVE_STATUSES } },
      data,
    });
    const current = await db.scrapeJob.findUnique({ where: { id }, select: { status: true } });
    if (updated.count !== 1) {
      if (current && isTerminalScrapeJobStatus(current.status)) {
        return NextResponse.json({ status: current.status, ignored: true });
      }
      return NextResponse.json({ error: "작업 상태가 변경되었습니다." }, { status: 409 });
    }

    return NextResponse.json({ status: current?.status ?? job.status });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
    }
    console.error("[worker heartbeat]", e);
    return NextResponse.json({ error: "하트비트 실패" }, { status: 500 });
  }
}
