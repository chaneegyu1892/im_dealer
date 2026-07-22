import { createHash } from "node:crypto";

/**
 * PII_ENCRYPTION_KEY 가 백엔드와 워커에서 동일한지 확인하기 위한 지문.
 *
 * 키 자체를 주고받으면 안 되므로 SHA-256 해시 앞 16자만 비교한다.
 * 역산이 불가능하고, 불일치 여부만 알려주기에는 충분하다.
 *
 * 워커가 키를 틀리게 넣어도 크래시가 나지 않고 job 을 받은 뒤에야
 * "자격증명 복호화 실패"로 조용히 끝나기 때문에, 실행 전에 이 값을 맞춰 본다.
 */
export function keyFingerprint(rawKey: string | undefined | null): string | null {
  const trimmed = rawKey?.trim();
  if (!trimmed) return null;
  // base64 로 디코딩한 실제 키 바이트를 기준으로 삼는다.
  // 같은 키를 공백·개행 차이로 다르게 적어도 같은 지문이 나오도록.
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.length === 0) return null;
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}
