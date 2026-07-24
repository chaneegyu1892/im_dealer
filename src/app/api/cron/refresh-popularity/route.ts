import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { refreshPopularitySnapshotFromNice } from "@/lib/recommend/popularity-runtime";
import { timingSafeEqualString } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * NICE D&R 공개 모델별 등록 순위 1~30위를 매월 서비스 DB에 저장한다.
 *
 * Vercel Cron은 CRON_SECRET을 Authorization Bearer로 전달한다. 수집·파싱·매핑 중
 * 하나라도 검증에 실패하면 기존의 마지막 정상 스냅샷을 건드리지 않는다.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/refresh-popularity] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const provided = auth.slice("Bearer ".length).trim();
  if (!timingSafeEqualString(provided, expected)) return unauthorized();

  try {
    const result = await refreshPopularitySnapshotFromNice();
    console.info("[cron/refresh-popularity] NICE 모델 순위 갱신 완료", {
      period: result.period,
      mappedEntries: result.mappedEntries,
      unmatchedEntries: result.unmatchedEntries.length,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const detail = {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    };
    console.error("[cron/refresh-popularity] NICE 모델 순위 갱신 실패", detail);
    Sentry.captureException(error, { tags: { cron: "refresh-popularity" } });
    return NextResponse.json({ error: "Popularity refresh failed" }, { status: 500 });
  }
}
