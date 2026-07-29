export interface ChannelTalkQuoteContext {
  quoteId: string;
  sessionId: string;
  vehicleName: string;
  trimName: string;
  productType: "장기렌트" | "리스";
  contractMonths: number;
  annualMileage: number;
}

// 같은 문서에서 실행되는 제3자 스크립트는 주민등록번호 입력 필드와 DOM 에 접근할 수 있다.
const CHANNEL_TALK_SUPPRESSED_PREFIXES = ["/verify"] as const;

export function isChannelTalkSuppressedPath(pathOrUrl: string): boolean {
  const pathname = pathOrUrl.split(/[?#]/)[0] ?? "";
  return CHANNEL_TALK_SUPPRESSED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function openChannelTalk(): boolean {
  if (typeof window === "undefined" || !window.ChannelIO) {
    return false;
  }

  window.ChannelIO("showMessenger");
  return true;
}

export function openChannelTalkWithQuote(context: ChannelTalkQuoteContext): boolean {
  if (typeof window === "undefined" || !window.ChannelIO) {
    return false;
  }

  window.ChannelIO("track", "quote_consultation_requested", context);
  window.ChannelIO("showMessenger");
  return true;
}
