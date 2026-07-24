/**
 * 워커가 page.goto 로 이동하기 전 URL 스킴을 검증한다.
 *
 * 자격증명 config 는 등록(PUT) 시점에 서버에서 검증되지만(src/lib/validations/admin.ts),
 * 그 이전에 저장됐거나 다른 경로로 들어온 DB 설정도 있을 수 있어 워커측에 별도 방어선을 둔다.
 * http/https 만 허용 — javascript:/file:/data: 등은 차단한다.
 */
export function assertHttpUrl(raw: string, label = "URL"): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${label} 형식이 올바르지 않습니다: ${raw.slice(0, 60)}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`${label} 은 http(s) 만 허용됩니다 (${u.protocol})`);
  }
  return raw;
}
