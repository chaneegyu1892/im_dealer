import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqualString } from "@/lib/security";

/**
 * 외부 워커 인증.
 * Authorization: Bearer <시크릿> 일치 시에만 통과.
 * cron/purge-pii 와 동일한 상수시간 비교 패턴. secret 미설정 시 500.
 *
 * 워커 종류마다 시크릿을 분리한다(스크래퍼 워커 / 알림톡 릴레이). 한쪽이 유출돼도
 * 다른 쪽 라우트까지 열리지 않게 하기 위함.
 *
 * 통과하면 { error: null }, 실패하면 { error: NextResponse } 반환.
 */
export function requireWorker(
  request: NextRequest,
  secretEnvKey: "SCRAPER_WORKER_SECRET" | "ALIMTALK_RELAY_SECRET" = "SCRAPER_WORKER_SECRET"
): { error: NextResponse | null } {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const provided = auth.slice("Bearer ".length).trim();
  const expected = process.env[secretEnvKey];
  if (!expected) {
    console.error(`[worker-auth] ${secretEnvKey} 환경변수가 설정되지 않았습니다.`);
    return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  }
  if (!timingSafeEqualString(provided, expected)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { error: null };
}
