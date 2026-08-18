import { createHash } from "crypto";
import { getTrustedClientIp } from "@/lib/client-ip";

/**
 * IP 주소를 단방향 해시로 변환 (개인정보 보호)
 * 같은 IP는 항상 같은 해시값 → 세션 추적은 가능하지만 역추적 불가
 *
 * 솔트 폴백 없음 — 하드코드된 솔트는 레인보우 테이블로 역추적을 허용한다.
 * env.ts 부팅 검증이 IP_HASH_SALT 를 강제하므로 여기선 누락 시 즉시 실패가 정답.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    throw new Error("IP_HASH_SALT 환경변수가 설정되지 않았습니다.");
  }
  return createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .slice(0, 16); // 16자만 저장 (충분한 고유성 + 저장 효율)
}

/**
 * Next.js Request에서 실제 클라이언트 IP 추출.
 * 신뢰 프록시 여부는 src/lib/client-ip 의 단일 정책을 따른다 —
 * 여기서 헤더를 직접 신뢰하면 rate limit 우회가 이 경로로 재발한다.
 * 신뢰할 수 없는 환경(미식별)은 "unknown" 을 반환한다.
 */
export function getClientIp(request: Request): string {
  return getTrustedClientIp(request.headers) ?? "unknown";
}
