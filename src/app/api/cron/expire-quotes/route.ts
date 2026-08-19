import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualString } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 만료 견적 리포터 — expiresAt 이 지난 오픈 SavedQuote 건수를 집계·기록한다.
 * 상태를 쓰지 않는다. LOST 는 인간 CRM 값(계약취소/이탈)이며 자동 전이는
 * 어드민 UI·referral isLost·quote/save 의 expiresAt 갱신(status === "NEW")을 오염한다.
 *
 * 고객 410 SSOT 는 SavedQuote.expiresAt (저장 시 +14일, quote/save/route.ts).
 * 이 크론은 410 경로를 축소하지 않는다(Codef carry-over 유지).
 *
 * WHERE: expiresAt <= now ∧ deletedAt IS NULL ∧ status ∈ {NEW, CONTACTED, IN_PROGRESS}
 *   - CONVERTED 는 계약 완료 — 집계에서 제외.
 *   - LOST 는 이미 인간 CRM 종결(재실행 멱등, 0건).
 *   - deletedAt 이 있으면 사용자/어드민 soft-delete — 집계에서 제외.
 *
 * 보호: Authorization: Bearer <CRON_SECRET> 일치 시에만 실행(outbound-sweep 과 동일).
 */

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleExpire(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/expire-quotes] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const provided = auth.slice("Bearer ".length).trim();
  if (!timingSafeEqualString(provided, expected)) return unauthorized();

  try {
    const now = new Date();
    const expiredActiveCount = await prisma.savedQuote.count({
      where: {
        expiresAt: { lte: now },
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED", "IN_PROGRESS"] },
      },
    });

    if (expiredActiveCount > 0) {
      console.info("[cron/expire-quotes] 만료 오픈 견적 집계", {
        expiredActiveCount,
        at: now.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      expiredActiveCount,
      at: now.toISOString(),
    });
  } catch (error) {
    const detail = {
      name: error instanceof Error ? error.name : "Unknown",
      message:
        error instanceof Error
          ? error.message.slice(0, 200)
          : String(error).slice(0, 200),
    };
    console.error("[cron/expire-quotes] 만료 견적 집계 실패:", detail);
    Sentry.captureException(error, { tags: { cron: "expire-quotes" } });
    return NextResponse.json({ error: "Quote expire report failed" }, { status: 500 });
  }
}

// Vercel Cron 은 GET 으로 호출 → GET 지원. 수동 재실행을 위해 POST 도 허용.
export async function GET(request: NextRequest) {
  return handleExpire(request);
}

export async function POST(request: NextRequest) {
  return handleExpire(request);
}
