import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { workerJobResultSchema } from "@/lib/validations/admin";

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
    const db = prisma as any;

    const job = await db.scrapeJob.findUnique({ where: { id }, select: { status: true, financeCompanyId: true } });
    if (!job) return NextResponse.json({ error: "없는 작업" }, { status: 404 });
    if (job.status === "canceled") {
      // 이미 취소됨 — 결과 무시
      return NextResponse.json({ success: true, ignored: true });
    }

    if (result.ok) {
      await db.scrapeJob.update({
        where: { id },
        data: { status: "completed", draft: result.draft, error: null, finishedAt: new Date() },
      });
    } else {
      await db.scrapeJob.update({
        where: { id },
        data: { status: "failed", error: result.error, finishedAt: new Date() },
      });
      // 잠금 방지 차단기: 자격증명 인증 실패면 해당 캐피탈사 자격증명을 비활성화해
      // 잘못된 비번으로 반복 로그인하다 계정이 잠기는 것을 막는다. + 관리자 알림.
      if (result.authFailed && job.financeCompanyId) {
        const fc = await db.financeCompany
          .findUnique({ where: { id: job.financeCompanyId }, select: { name: true } })
          .catch(() => null);
        const name = fc?.name ?? job.financeCompanyId;
        await db.capitalScraperCredential
          .update({ where: { financeCompanyId: job.financeCompanyId }, data: { isActive: false } })
          .catch(() => null);
        await db.adminNotification
          .create({
            data: {
              type: "SYSTEM",
              title: `[${name}] 스크래퍼 자격증명 비활성화`,
              content: `로그인 인증 실패로 자격증명을 자동 비활성화했습니다(계정 잠금 방지). 비밀번호 변경 여부를 확인 후 재등록하세요. 사유: ${result.error.slice(0, 120)}`,
              linkUrl: "/admin/finance",
            },
          })
          .catch(() => null);
      }
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
