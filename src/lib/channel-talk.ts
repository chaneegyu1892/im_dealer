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

// 비즈톡 자동발송 연동 전 임시방편: '견적서 받기'를 눌렀을 때
// 채널톡 상담창을 열고 요청 메시지를 미리 채워, 고객이 전송하면
// 담당자가 수동으로 견적서 이미지를 보내도록 유도한다.
export function openChannelTalkWithQuoteMessage(
  context: ChannelTalkQuoteContext,
  message: string
): boolean {
  if (typeof window === "undefined" || !window.ChannelIO) {
    return false;
  }

  window.ChannelIO("track", "quote_consultation_requested", context);
  window.ChannelIO("openChat", undefined, message);
  return true;
}

// 카카오 채널로 견적서를 요청할 때, 상담사가 채널톡 데스크에서 볼 견적 컨텍스트를 남긴다.
// (고객은 카카오 채널로 메시지를 보내고, 채널톡↔카카오 연동으로 상담이 뜬다.)
export function trackQuoteDeliveryRequested(context: ChannelTalkQuoteContext): void {
  if (typeof window === "undefined" || !window.ChannelIO) return;
  window.ChannelIO("track", "quote_delivery_requested", context);
}
