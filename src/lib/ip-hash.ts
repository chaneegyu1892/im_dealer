import { createHash } from "crypto";

/**
 * IP 주소를 단방향 해시로 변환 (개인정보 보호)
 * 같은 IP는 항상 같은 해시값 → 세션 추적은 가능하지만 역추적 불가
 */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "imdealers-salt"))
    .digest("hex")
    .slice(0, 16); // 16자만 저장 (충분한 고유성 + 저장 효율)
}

/**
 * Next.js Request에서 실제 클라이언트 IP 추출
 * Vercel/프록시 환경 대응
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
