/**
 * 클라이언트 IP 추출의 단일 출처.
 *
 * x-forwarded-for 는 클라이언트가 위조할 수 있는 헤더다. XFF를 append 방식으로
 * 다루는 프록시(nginx 기본 동작) 뒤에서 이 값을 무조건 신뢰하면 per-IP rate limit
 * 전체를 헤더 위조로 우회당한다. 따라서 신뢰할 수 있는 프록시 환경
 * (TRUST_PROXY=true 또는 Vercel)에서만 헤더를 신뢰하고, 그 외에는 null 을 반환한다.
 *
 * proxy.ts(middleware) 와 라우트 레벨(rate-limit, ip-hash, 개별 라우트)이
 * 서로 다른 정책을 쓰지 않도록 이 모듈이 유일한 구현이다.
 * 순수 헤더 파싱만 하므로 edge 런타임에서도 안전하게 import 가능하다.
 */
export function getTrustedClientIp(headers: Headers): string | null {
  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.VERCEL === "1";
  if (!trustProxy) return null;

  // x-forwarded-for 첫 번째 값만 사용. Vercel 은 XFF 를 덮어쓰고,
  // 신뢰 프록시가 append 한 체인의 첫 값이 원 클라이언트다.
  // ⚠️ 운영 제약: TRUST_PROXY=true 는 "프록시가 XFF 를 덮어쓰는" 토폴로지(Vercel 등) 전용이다.
  // nginx 처럼 append 하는 프록시 뒤에서 쓰면 클라이언트가 위조한 XFF 첫 값을 신뢰하게 되어
  // per-IP rate limit 우회·감사로그 위조가 가능하다. append 방식 프록시에서는 TRUST_PROXY 를
  // 쓰지 말거나, 프록시 단에서 XFF 를 덮어쓰도록 구성해야 한다.
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xreal = headers.get("x-real-ip");
  if (xreal) return xreal.trim();
  return null;
}
