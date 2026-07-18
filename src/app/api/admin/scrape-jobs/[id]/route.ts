import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { scrapeJobActionSchema } from "@/lib/validations/admin";

// GET /api/admin/scrape-jobs/[id] — 작업 상태 폴링 (자격증명은 절대 반환하지 않음)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const { id } = await params;
    const job = await prisma.scrapeJob.findUnique({
      where: { id },
      select: {
        id: true,
        financeCompanyId: true,
        jobType: true,
        status: true,
        productType: true,
        error: true,
        humanPrompt: true,
        draft: true,
        progress: true,
        heartbeatAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });
    return NextResponse.json({ success: true, job });
  } catch (e) {
    console.error("[scrape-jobs GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// PATCH /api/admin/scrape-jobs/[id] — 취소 / 재개(2FA 완료 신호)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const { id } = await params;
    const { action } = scrapeJobActionSchema.parse(await request.json());
    const db = prisma;

    const job = await db.scrapeJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });

    if (action === "cancel") {
      if (!["pending", "running", "needs_human"].includes(job.status)) {
        return NextResponse.json({ error: "취소할 수 없는 상태입니다." }, { status: 409 });
      }
      const canceled = await db.scrapeJob.updateMany({
        where: { id, status: { in: ["pending", "running", "needs_human"] } },
        // 취소 — 임시 로그인 정보 폐기
        data: { status: "canceled", finishedAt: new Date(), credUsernameEnc: null, credPasswordEnc: null },
      });
      if (canceled.count !== 1) {
        return NextResponse.json({ error: "작업 상태가 변경되었습니다." }, { status: 409 });
      }
    } else {
      // resume: 사람 인증 완료 → 워커가 이어가도록 running 으로 전환
      if (job.status !== "needs_human") {
        return NextResponse.json({ error: "재개할 수 없는 상태입니다." }, { status: 409 });
      }
      const resumed = await db.scrapeJob.updateMany({
        where: { id, status: "needs_human" },
        data: { status: "running", humanPrompt: null, heartbeatAt: new Date() },
      });
      if (resumed.count !== 1) {
        return NextResponse.json({ error: "작업 상태가 변경되었습니다." }, { status: 409 });
      }
    }

    await logAdminAction({
      request,
      actor: session,
      action: action === "cancel" ? "SCRAPE_JOB_CANCEL" : "SCRAPE_JOB_RESUME",
      resource: "ScrapeJob",
      targetId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
    }
    console.error("[scrape-jobs PATCH]", e);
    return NextResponse.json({ error: "변경 실패" }, { status: 500 });
  }
}
