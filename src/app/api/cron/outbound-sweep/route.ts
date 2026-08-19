import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualString } from "@/lib/security";
import { ALIMTALK_LEASE_STALE_MS, ALIMTALK_MAX_ATTEMPTS } from "@/lib/alimtalk/types";

/**
 * 아웃바운드 스윕 — 발송 파이프라인에서 끝을 못 맺은 행을 종결한다.
 *
 * 보호: Authorization: Bearer <CRON_SECRET> 일치 시에만 실행(purge-pii 와 동일 패턴).
 *
 * 3종 스윕(전부 조건부 updateMany — 상태 전이 조건이 where 안에 있어 중첩 실행에 멱등):
 *   1. 데드레터 — attempts>=3 인 PENDING/리스 끊긴 SENDING 알림톡 → FAILED.
 *      claim 은 attempts<3 만 집으므로 이 행들은 영원히 재시도되지 않는다.
 *   2. stale ACCEPTED — 비즈톡 결과 큐는 24시간만 보관한다(docs/biztalk-alimtalk-plan.md §1.4 #6).
 *      접수(sentAt) 후 25시간(24h+여유)까지 resultCode 가 없으면 결과를 영영 못 받는다.
 *      SENT 로 단정하면 도달률을 과장하므로 "결과 미수신" 실패로 기록만 남긴다(§8 3005/ME09 원칙).
 *   3. delivery 좀비 — /api/quote/deliver maxDuration=30초. 그보다 10배(5분) 오래
 *      PENDING 인 QuoteDelivery 는 요청이 죽은 것이므로 markDeliveryFailed 상당 처리.
 *      (deliver/route.ts 내부 함수라 export 되지 않는다 — 여기서 동등한 prisma update 를 직접 수행)
 *
 * 스윕은 상태 정리만 한다. 재발송 큐잉(enqueueAlimtalk·attempts 리셋·PENDING 회귀)은 하지 않는다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 비즈톡 결과큐 보관 24시간 + 1시간 여유. 이보다 오래된 ACCEPTED 는 결과 도착 가능성이 없다. */
const ACCEPTED_STALE_MS = 25 * 60 * 60 * 1000;
/** deliver maxDuration(30초)의 10배. 방금 만들어진 PENDING 을 오탐하지 않는 여유. */
const DELIVERY_ZOMBIE_MS = 5 * 60 * 1000;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleSweep(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/outbound-sweep] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const provided = auth.slice("Bearer ".length).trim();
  if (!timingSafeEqualString(provided, expected)) return unauthorized();

  try {
    const now = new Date();
    const leaseStaleCutoff = new Date(now.getTime() - ALIMTALK_LEASE_STALE_MS);
    const acceptedCutoff = new Date(now.getTime() - ACCEPTED_STALE_MS);
    const deliveryCutoff = new Date(now.getTime() - DELIVERY_ZOMBIE_MS);

    // 1) 데드레터. SENDING 은 리스가 끊긴(10분 무보고) 것만 — 3차 시도가 진행 중인 행과 경합하지 않는다.
    //    resultAt 는 찍어둔다: result 라우트의 재기록 가드(resultAt: null + status in [SENDING,ACCEPTED])와 정합해
    //    데드레터된 행에 늦은 결과가 도착해도 스킵된다(불확실→실패 기록 유지, 과대표기 방지).
    const deadLettered = await prisma.alimtalkMessage.updateMany({
      where: {
        attempts: { gte: ALIMTALK_MAX_ATTEMPTS },
        OR: [
          { status: "PENDING" },
          { status: "SENDING", claimedAt: { lt: leaseStaleCutoff } },
        ],
      },
      data: {
        status: "FAILED",
        failReason: `재시도 한도(${ALIMTALK_MAX_ATTEMPTS}회) 초과 — 아웃바운드 스윕 데드레터`,
        leaseToken: null,
      },
    });

    // 2) stale ACCEPTED 확정. resultAt 를 찍어 result 라우트의 재기록 가드(resultAt: null)와 정합.
    const staleAccepted = await prisma.alimtalkMessage.updateMany({
      where: { status: "ACCEPTED", sentAt: { lt: acceptedCutoff } },
      data: {
        status: "FAILED",
        failReason: "전송 결과 미수신(결과큐 24시간 보관 만료) — 아웃바운드 스윕 확정",
        resultAt: now,
      },
    });

    // 3) delivery 좀비. where 에 status:"PENDING" 이 있어 두 번째 실행은 0건(멱등).
    const deliveryZombies = await prisma.quoteDelivery.updateMany({
      where: { status: "PENDING", createdAt: { lt: deliveryCutoff } },
      data: {
        status: "FAILED",
        failReason: "전송 처리 중단(maxDuration 30초 초과 잔류) — 아웃바운드 스윕 확정",
      },
    });

    if (
      deadLettered.count + staleAccepted.count + deliveryZombies.count >
      0
    ) {
      console.info("[cron/outbound-sweep] 종결", {
        deadLettered: deadLettered.count,
        staleAccepted: staleAccepted.count,
        deliveryZombies: deliveryZombies.count,
      });
    }

    return NextResponse.json({
      success: true,
      deadLettered: deadLettered.count,
      staleAcceptedFinalized: staleAccepted.count,
      deliveryZombiesFailed: deliveryZombies.count,
      leaseStaleCutoff: leaseStaleCutoff.toISOString(),
      acceptedCutoff: acceptedCutoff.toISOString(),
      deliveryCutoff: deliveryCutoff.toISOString(),
    });
  } catch (error) {
    const detail = {
      name: error instanceof Error ? error.name : "Unknown",
      message:
        error instanceof Error
          ? error.message.slice(0, 200)
          : String(error).slice(0, 200),
    };
    console.error("[cron/outbound-sweep] 실패:", detail);
    Sentry.captureException(error, { tags: { cron: "outbound-sweep" } });
    return NextResponse.json({ error: "Outbound sweep failed" }, { status: 500 });
  }
}

// Vercel Cron 은 GET 으로 호출 → GET 지원. 수동 재실행을 위해 POST 도 허용.
export async function GET(request: NextRequest) {
  return handleSweep(request);
}

export async function POST(request: NextRequest) {
  return handleSweep(request);
}
