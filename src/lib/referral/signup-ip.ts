import { getClientIp, hashIp } from "@/lib/ip-hash";

/**
 * 어뷰징 관찰용 가입 IP 해시 (Referral.signupIpHash).
 * IP를 알 수 없으면 null — "unknown" 상수를 해시하면 모든 미상 IP가
 * 같은 값으로 뭉쳐 오히려 신호를 오염시킨다.
 */
export function signupIpHashFromRequest(request: Request): string | null {
  const ip = getClientIp(request);
  return ip === "unknown" ? null : hashIp(ip);
}
