import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqualString } from "@/lib/security";

/**
 * 로컬 스크래퍼 워커 인증.
 * Authorization: Bearer <SCRAPER_WORKER_SECRET> 일치 시에만 통과.
 * cron/purge-pii 와 동일한 상수시간 비교 패턴. secret 미설정 시 500.
 *
 * 통과하면 { error: null }, 실패하면 { error: NextResponse } 반환.
 */
export function requireWorker(request: NextRequest): { error: NextResponse | null } {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const provided = auth.slice("Bearer ".length).trim();
  const expected = process.env.SCRAPER_WORKER_SECRET;
  if (!expected) {
    console.error("[worker-auth] SCRAPER_WORKER_SECRET 환경변수가 설정되지 않았습니다.");
    return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  }
  if (!timingSafeEqualString(provided, expected)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { error: null };
}
