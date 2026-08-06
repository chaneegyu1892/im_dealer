/**
 * 카카오톡 인앱브라우저 판별과 외부 브라우저 탈출 URL 생성.
 *
 * 전역 navigator·location 을 직접 읽지 않고 인자로만 받는다. 실기기 없이
 * 단위 테스트할 수 있게 하기 위한 제약이다. 전역 접근은 useKakaoTalkInApp 훅이 맡는다.
 */

// 카카오톡은 iOS(`KAKAOTALK 10.5.0`)와 Android(`KAKAOTALK/10.5.0`)의 버전 구분자가
// 다르므로 토큰만 본다. 다른 인앱브라우저를 지원하려면 여기에 패턴을 추가한다.
const KAKAOTALK_UA = /KAKAOTALK/i;
const IOS_UA = /iPhone|iPad|iPod/i;
const ANDROID_UA = /Android/i;

const ALLOWED_PROTOCOLS: readonly string[] = ["http:", "https:"];

/** UA 문자열이 카카오톡 인앱브라우저인지 판별한다. */
export function isKakaoTalkInApp(userAgent: string): boolean {
  return KAKAOTALK_UA.test(userAgent);
}

/**
 * 카카오톡 인앱브라우저를 벗어나 외부 브라우저로 targetUrl 을 여는 URL 을 만든다.
 * 인앱브라우저가 아니거나 플랫폼에 탈출 스킴이 없으면 null 을 돌려준다.
 */
export function buildEscapeUrl(
  targetUrl: string,
  userAgent: string
): string | null {
  if (!isKakaoTalkInApp(userAgent)) return null;

  const url = parseHttpUrl(targetUrl);
  if (!url) return null;

  if (IOS_UA.test(userAgent)) {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(url.href)}`;
  }

  if (ANDROID_UA.test(userAgent)) {
    // 원본 해시는 intent URI 의 `#Intent` 구분자와 충돌하므로 경로에서 뺀다.
    // 대신 fallback URL 에는 해시를 포함한 전체 주소를 넣어 정보를 잃지 않는다.
    const path = `${url.host}${url.pathname}${url.search}`;
    const scheme = url.protocol.replace(":", "");
    const fallback = encodeURIComponent(url.href);
    // package 를 지정하지 않는다. 특정 패키지로 고정하면 그 브라우저가 없는 기기에서
    // Intent.parseUri 가 예외를 던지고 카카오톡은 S.browser_fallback_url(=지금 이 페이지)로
    // 되돌아가 인앱브라우저 안에서 같은 페이지를 다시 로드할 뿐이다. 지정하지 않으면
    // 안드로이드가 브라우저 선택 창을 띄우므로 어떤 기기에서도 실제로 탈출할 수 있다.
    return (
      `intent://${path}#Intent;scheme=${scheme}` +
      `;S.browser_fallback_url=${fallback};end`
    );
  }

  return null;
}

/** http/https 인 URL 만 파싱해 돌려준다. javascript: 등은 null. */
function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return null;
    return url;
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}
