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

// 카카오 채널로 견적서를 요청할 때, 상담사가 채널톡 데스크에서 볼 견적 컨텍스트를 남긴다.
// (고객은 카카오 채널로 메시지를 보내고, 채널톡↔카카오 연동으로 상담이 뜬다.)
export function trackQuoteDeliveryRequested(context: ChannelTalkQuoteContext): void {
  if (typeof window === "undefined" || !window.ChannelIO) return;
  window.ChannelIO("track", "quote_delivery_requested", context);
}

// 고객이 "보냈어요"로 전송을 자가 확인했을 때. 요청만 하고 실제로 안 보낸 고객과
// 구분되어, 상담사가 미전송 건에 먼저 연락할 수 있다.
export function trackQuoteDeliverySent(context: ChannelTalkQuoteContext): void {
  if (typeof window === "undefined" || !window.ChannelIO) return;
  window.ChannelIO("track", "quote_delivery_sent", context);
}
