/**
 * 워커가 page.goto 로 이동하기 전 URL 스킴을 검증한다.
 *
 * 코드에 내장된 접속 URL과 로컬 단독 테스트 설정 모두 이 경계를 통과한다.
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
