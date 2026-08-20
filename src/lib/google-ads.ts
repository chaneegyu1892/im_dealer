/**
 * Google Ads 전환 추적 (gtag.js).
 *
 * 전환 ID·라벨은 광고 대행사가 발급해 공유한 값이라 코드에 박지 않고 환경변수로 주입한다.
 * 대행사 교체나 계정 이관 시 배포 없이 값만 갈아끼우면 되고, 값이 비어 있는
 * 로컬·CI·프리뷰에서는 태그가 아예 로드되지 않아 운영 전환 지표가 오염되지 않는다.
 *
 * 아임딜러 견적 흐름에는 '주문 감사 페이지'가 없다(스텝 1~3 SPA → /verify 이동).
 * 그래서 구글이 안내하는 "전환 페이지 head 에 이벤트 스니펫 붙여넣기"를 쓸 수 없고,
 * 견적 저장이 성공한 시점에 trackQuoteRequestConversion() 을 직접 호출한다.
 */

/** 전환 ID 형식(AW-숫자). 인라인 스크립트에 보간되므로 형식을 벗어난 값은 버린다. */
const CONVERSION_ID_PATTERN = /^AW-\d{6,}$/;

/** 전환 라벨 형식. 구글이 발급하는 base64url 문자만 허용한다. */
const CONVERSION_LABEL_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

/** 이미 보고한 견적 ID 보관 키. 뒤로가기·재제출로 인한 중복 전환을 막는다. */
const REPORTED_QUOTES_STORAGE_KEY = "imdealer:google-ads:reported-quotes";

/** 보관할 최근 견적 ID 개수 상한 — localStorage 무한 증가 방지. */
const REPORTED_QUOTES_LIMIT = 50;

const CONVERSION_CURRENCY = "KRW";

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

/**
 * 전체 사이트 태그용 전환 ID. 형식이 어긋나면 빈 문자열을 돌려 태그를 끈다.
 *
 * NEXT_PUBLIC_* 는 Next 가 빌드 시 리터럴 접근만 치환하므로
 * process.env[변수명] 같은 동적 접근을 쓰면 브라우저에서 undefined 가 된다.
 */
export function googleAdsConversionId(): string {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim() ?? "";
  return CONVERSION_ID_PATTERN.test(raw) ? raw : "";
}

/** '견적 요청' 전환 액션 라벨. 형식이 어긋나면 빈 문자열. */
export function googleAdsQuoteRequestLabel(): string {
  const raw =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_QUOTE_REQUEST_LABEL?.trim() ?? "";
  return CONVERSION_LABEL_PATTERN.test(raw) ? raw : "";
}

/**
 * 전체 사이트 태그를 실을지 여부.
 * 라벨이 없어도 ID 만 있으면 태그는 싣는다 — gclid 수집은 전환 라벨과 무관하게 필요하다.
 */
export function isGoogleAdsEnabled(): boolean {
  return googleAdsConversionId().length > 0;
}

/** 전환 이벤트의 send_to 값('AW-…/라벨'). 둘 중 하나라도 없으면 null. */
export function googleAdsQuoteRequestSendTo(): string | null {
  const conversionId = googleAdsConversionId();
  const label = googleAdsQuoteRequestLabel();
  if (!conversionId || !label) return null;
  return `${conversionId}/${label}`;
}

function readReportedQuoteIds(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(REPORTED_QUOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // 사파리 프라이빗 모드 등 저장소 접근 불가 — 중복 방지만 포기하고 전환은 계속 보낸다.
    return [];
  }
}

function rememberReportedQuoteId(
  quoteId: string,
  reported: readonly string[]
): void {
  try {
    const next = [...reported, quoteId].slice(-REPORTED_QUOTES_LIMIT);
    window.localStorage.setItem(
      REPORTED_QUOTES_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch {
    // 저장 실패가 전환 보고를 되돌릴 이유는 없다.
  }
}

export type QuoteRequestConversion = {
  /** 저장된 견적 ID. 구글 서버측 중복 제거(transaction_id)에도 함께 쓴다. */
  quoteId: string;
  /** 전환 가치(원). 생략하면 가치 없이 건수만 집계한다. */
  value?: number;
};

/**
 * '견적 요청' 전환을 Google Ads 로 보낸다.
 *
 * 어느 단계에서든 조용히 실패한다 — 광고 측정 실패가 견적 흐름을 막아선 안 된다.
 * @returns 실제로 전환을 발사했으면 true.
 */
export function trackQuoteRequestConversion({
  quoteId,
  value,
}: QuoteRequestConversion): boolean {
  if (typeof window === "undefined") return false;

  const sendTo = googleAdsQuoteRequestSendTo();
  if (!sendTo || !quoteId) return false;

  const gtag = window.gtag;
  // 태그 로드 전이거나 광고 차단기가 막은 경우.
  if (typeof gtag !== "function") return false;

  const reported = readReportedQuoteIds();
  if (reported.includes(quoteId)) return false;

  const hasValue = typeof value === "number" && Number.isFinite(value) && value > 0;

  gtag("event", "conversion", {
    send_to: sendTo,
    transaction_id: quoteId,
    ...(hasValue ? { value, currency: CONVERSION_CURRENCY } : {}),
  });

  rememberReportedQuoteId(quoteId, reported);
  return true;
}
