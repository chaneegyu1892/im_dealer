import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { cleanupExpiredQuoteImages } from "@/lib/quote-delivery/lifecycle";
import { timingSafeEqualString } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleCleanup(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/purge-quote-images] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const provided = auth.slice("Bearer ".length).trim();
  if (!timingSafeEqualString(provided, expected)) return unauthorized();

  try {
    const result = await cleanupExpiredQuoteImages();
    if (result.failures.length > 0) {
      console.error("[cron/purge-quote-images] 일부 이미지 정리 실패:", {
        scanned: result.scanned,
        deleted: result.deleted,
        failures: result.failures,
      });
      Sentry.captureException(new Error("Quote image cleanup incomplete"), {
        tags: { cron: "purge-quote-images" },
        extra: { failures: result.failures, scanned: result.scanned },
      });
      return NextResponse.json(
        {
          error: "Quote image cleanup incomplete",
          ...result,
          cutoff: result.cutoff.toISOString(),
        },
        { status: 500 }
      );
    }

    console.info("[cron/purge-quote-images] 공개 견적 이미지 정리 완료", {
      scanned: result.scanned,
      deleted: result.deleted,
      retentionDays: result.retentionDays,
    });
    return NextResponse.json({
      success: true,
      ...result,
      cutoff: result.cutoff.toISOString(),
    });
  } catch (error) {
    const detail = {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    };
    console.error("[cron/purge-quote-images] 공개 견적 이미지 정리 실패:", detail);
    Sentry.captureException(error, { tags: { cron: "purge-quote-images" } });
    return NextResponse.json({ error: "Quote image cleanup failed" }, { status: 500 });
  }
}

// Vercel Cron은 GET으로 호출하고, 운영자가 수동으로 재시도할 수 있도록 POST도 지원한다.
export async function GET(request: NextRequest) {
  return handleCleanup(request);
}

export async function POST(request: NextRequest) {
  return handleCleanup(request);
}
