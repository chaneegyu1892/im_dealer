/**
 * 상수 시간 문자열 비교 (Edge runtime 호환).
 * 길이가 다르면 즉시 false; 같으면 모든 바이트를 XOR 누적해서 분기 없이 비교.
 *
 * 어드민 access 토큰처럼 단순 동등 비교가 필요한 시크릿에 사용.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
