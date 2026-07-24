import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { workerHeartbeatSchema } from "@/lib/validations/admin";

// POST /api/worker/scrape-jobs/[id]/heartbeat
// 워커 생존 신호 갱신 + 선택적 needs_human 전환. 응답에 현재 status 를 실어
// 워커가 어드민의 cancel/resume 을 인지하게 한다.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireWorker(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = workerHeartbeatSchema.parse(await request.json().catch(() => ({})));
    const db = prisma as any;

    const job = await db.scrapeJob.findUnique({ where: { id }, select: { status: true } });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });

    // 어드민이 이미 취소했으면 상태를 덮어쓰지 않는다 (워커가 중단하도록 canceled 그대로 반환)
    if (job.status === "canceled") {
      return NextResponse.json({ status: "canceled" });
    }

    const data: Record<string, unknown> = { heartbeatAt: new Date() };
    if (body.status === "needs_human") {
      data.status = "needs_human";
      if (body.humanPrompt !== undefined) data.humanPrompt = body.humanPrompt;
    }

    const updated = await db.scrapeJob.update({
      where: { id },
      data,
      select: { status: true },
    });

    return NextResponse.json({ status: updated.status });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
    }
    console.error("[worker heartbeat]", e);
    return NextResponse.json({ error: "하트비트 실패" }, { status: 500 });
  }
}
