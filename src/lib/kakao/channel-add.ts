"use client";

// 카카오톡 채널 1:1 채팅 URL (클라이언트 window.open 용).
//
// 주의: 반드시 클릭 핸들러에서 "동기적으로" window.open 해야 한다.
// API 호출·SDK 로드 등 await 뒤에 창을 열면 사용자 제스처가 만료돼 팝업 차단기에
// 막힌다. 실제로 채널추가 팝업 + 대화창을 연달아 열다 대화창이 차단되어
// 고객이 채널 홈에 떨어지는 문제가 있었다 — 그래서 SDK 팝업 방식을 걷어냈다.
//
// env: NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID  채널 공개 ID (_XXXXX)

export function kakaoChannelChatUrl(): string | null {
  const id = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID?.trim();
  if (!id) {
    console.warn("[kakao] NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID 미설정");
    return null;
  }
  return `https://pf.kakao.com/${id}/chat`;
}
