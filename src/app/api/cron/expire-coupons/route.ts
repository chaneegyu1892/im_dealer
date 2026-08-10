import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualString } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 유효기간이 지난 HELD 쿠폰을 EXPIRED 로 만료시킨다.
 *
 * reconcile(rules.ts) 도 방문 시점에 같은 만료 처리를 하지만, 회원이 마이페이지에
 * 들르지 않으면 만료가 지연돼 어드민 발급 현황 집계가 부풀어 보인다. 이 크론은
 * 정시에 전수를 스윕해 그 격차를 메운다.
 *
 * HELD 만 스윕하는 것은 reconcile 의 만료 우선 규칙과 의도 일치:
 * PENDING(자격 획득) 쿠폰은 노미널 만료가 지나도 자격을 빼앗지 않고 PAID 대기로 둔다.
 *
 * 보호: Authorization: Bearer <CRON_SECRET> 일치 시에만 실행(purge-pii 와 동일).
 */

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleExpire(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/expire-coupons] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const provided = auth.slice("Bearer ".length).trim();
  if (!timingSafeEqualString(provided, expected)) return unauthorized();

  try {
    const now = new Date();
    const result = await prisma.issuedCoupon.updateMany({
      where: {
        status: "HELD",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    console.info("[cron/expire-coupons] 쿠폰 만료 스윕 완료", {
      expired: result.count,
      at: now.toISOString(),
    });
    return NextResponse.json({
      success: true,
      expired: result.count,
      at: now.toISOString(),
    });
  } catch (error) {
    console.error("[cron/expire-coupons] 쿠폰 만료 스윕 실패:", error);
    Sentry.captureException(error, { tags: { cron: "expire-coupons" } });
    return NextResponse.json({ error: "Coupon expire sweep failed" }, { status: 500 });
  }
}

// Vercel Cron 은 GET 으로 호출하고 운영자 수동 재시도를 위해 POST 도 지원한다.
export async function GET(request: NextRequest) {
  return handleExpire(request);
}

export async function POST(request: NextRequest) {
  return handleExpire(request);
}
