import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { resolveCapitalConnection } from "@/lib/scraper/connections";
import { buildClaimLeaseWhere } from "@/lib/scraper/job-state";
import { markWorkerSeen } from "@/lib/scraper/worker-presence";

const STALE_MS = 3 * 60 * 1000; // 하트비트 3분 초과 시 워커가 죽은 것으로 보고 재클레임

// POST /api/worker/scrape-jobs/claim — 대기 작업 1건을 원자적으로 클레임
// 반환 자격증명은 암호문 그대로. 복호화는 워커가 자신의 PII_ENCRYPTION_KEY 로 로컬 수행.
export async function POST(request: NextRequest) {
  const { error } = requireWorker(request);
  if (error) return error;

  // 워커가 유휴 상태일 때도 이 라우트를 주기적으로 호출하므로, 여기서 생존 신호를 남긴다.
  // 실패해도 클레임 자체를 막지 않는다(상태 표시는 부가 기능).
  void markWorkerSeen().catch(() => undefined);

  try {
    const db = prisma;
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
      where: buildClaimLeaseWhere(candidate, staleCutoff),
      data: { status: "running", claimedAt: now, heartbeatAt: now },
    });
    if (claimed.count !== 1) {
      // 다른 워커가 먼저 가져감 — 다음 폴링에서 재시도
      return NextResponse.json({ job: null });
    }

    // 로그인 URL·어댑터는 코드 내장, ID/PW 암호문은 작업에 임시 저장된 것을 사용
    const fc = await prisma.financeCompany.findUnique({
      where: { id: candidate.financeCompanyId },
      select: { name: true },
    });
    const connection = fc ? resolveCapitalConnection(fc.name) : null;
    // requiresHuman 캐피탈사는 어댑터가 자격증명을 쓰지 않으므로 애초에 저장하지 않는다.
    // 그런 곳까지 "로그인 정보 없음"으로 실패시키면 안 된다.
    const needsCredentials = connection !== null && !connection.requiresHuman;
    const credentialsMissing =
      needsCredentials && (!candidate.credUsernameEnc || !candidate.credPasswordEnc);

    if (!connection || credentialsMissing) {
      // 접속 설정이 없거나, 필요한데 임시 자격증명이 사라짐 → 작업 실패 처리
      await db.scrapeJob.updateMany({
        where: { id: candidate.id, status: "running", claimedAt: now },
        data: {
          status: "failed",
          error: connection ? "로그인 정보 없음" : "지원하지 않는 캐피탈사",
          finishedAt: new Date(),
          credUsernameEnc: null,
          credPasswordEnc: null,
        },
      });
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: candidate.id,
        financeCompanyId: candidate.financeCompanyId,
        jobType: candidate.jobType ?? "trim_rates",
        productType: candidate.productType,
        params: candidate.params,
      },
      credential: {
        loginUrl: connection.loginUrl,
        usernameEnc: candidate.credUsernameEnc ?? "",
        passwordEnc: candidate.credPasswordEnc ?? "",
        config: { adapter: connection.adapter },
        requiresHuman: connection.requiresHuman,
      },
    });
  } catch (e) {
    console.error("[worker claim]", e);
    return NextResponse.json({ error: "클레임 실패" }, { status: 500 });
  }
}
