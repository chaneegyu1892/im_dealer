import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";

const STALE_MS = 3 * 60 * 1000; // 하트비트 3분 초과 시 워커가 죽은 것으로 보고 재클레임

// POST /api/worker/scrape-jobs/claim — 대기 작업 1건을 원자적으로 클레임
// 반환 자격증명은 암호문 그대로. 복호화는 워커가 자신의 PII_ENCRYPTION_KEY 로 로컬 수행.
export async function POST(request: NextRequest) {
  const { error } = requireWorker(request);
  if (error) return error;

  try {
    const db = prisma as any;
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_MS);

    // pending 우선, 없으면 하트비트가 끊긴 running/needs_human(=죽은 워커) 회수
    const candidate = await db.scrapeJob.findFirst({
      where: {
        OR: [
          { status: "pending" },
          { status: { in: ["running", "needs_human"] }, heartbeatAt: { lt: staleCutoff } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) return NextResponse.json({ job: null });

    // 이중 클레임 방지: 후보의 현재 상태를 조건으로 건 updateMany 가 정확히 1건일 때만 성공
    const claimed = await db.scrapeJob.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: { status: "running", claimedAt: now, heartbeatAt: now },
    });
    if (claimed.count !== 1) {
      // 다른 워커가 먼저 가져감 — 다음 폴링에서 재시도
      return NextResponse.json({ job: null });
    }

    const cred = await db.capitalScraperCredential.findUnique({
      where: { financeCompanyId: candidate.financeCompanyId },
    });
    if (!cred || !cred.isActive) {
      // 자격증명이 사라졌거나 비활성 → 작업 실패 처리
      await db.scrapeJob.update({
        where: { id: candidate.id },
        data: { status: "failed", error: "자격증명 없음 또는 비활성", finishedAt: new Date() },
      });
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: candidate.id,
        financeCompanyId: candidate.financeCompanyId,
        productType: candidate.productType,
        params: candidate.params,
      },
      credential: {
        loginUrl: cred.loginUrl,
        usernameEnc: cred.usernameEnc,
        passwordEnc: cred.passwordEnc,
        config: cred.config ?? null,
        requiresHuman: cred.requiresHuman,
      },
    });
  } catch (e) {
    console.error("[worker claim]", e);
    return NextResponse.json({ error: "클레임 실패" }, { status: 500 });
  }
}
