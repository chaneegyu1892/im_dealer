"use client";

// 카카오톡 채널추가 팝업 (클라이언트 전용).
// Kakao JS SDK 를 지연 로드해 Kakao.Channel.addChannel 팝업을 띄운다.
// JS 키/채널 ID 미설정이거나 SDK 로드 실패 시 채널 친구추가 URL 로 폴백한다.
//
// env:
//   NEXT_PUBLIC_KAKAO_JS_KEY             카카오 JavaScript 앱 키
//   NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID  채널 공개 ID (_XXXXX)

const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

interface KakaoChannelApi {
  addChannel: (opts: { channelPublicId: string }) => void;
  chat: (opts: { channelPublicId: string }) => void;
}
interface KakaoSDK {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Channel: KakaoChannelApi;
}

declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

function channelPublicId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID?.trim();
  return id ? id : undefined;
}

function loadKakaoSdk(): Promise<KakaoSDK | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim();
    if (!jsKey) return resolve(null);

    const init = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(jsKey);
      resolve(window.Kakao ?? null);
    };
    if (window.Kakao) return init();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.addEventListener("load", init, { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(script);
  });
}

/**
 * 카카오톡 채널추가 팝업을 띄운다.
 * SDK 사용 불가 시 채널 친구추가 URL(pf.kakao.com/_XXXXX/friend)을 새 창으로 연다.
 * 채널 ID 미설정이면 false 를 반환한다(호출부에서 폴백 안내).
 */
export async function addKakaoChannel(): Promise<boolean> {
  const id = channelPublicId();
  if (!id) {
    console.warn("[kakao] NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID 미설정");
    return false;
  }

  const kakao = await loadKakaoSdk();
  if (kakao?.Channel) {
    kakao.Channel.addChannel({ channelPublicId: id });
    return true;
  }

  // 폴백: 친구추가 URL (JS 키 없이도 동작)
  window.open(`https://pf.kakao.com/${id}/friend`, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * 카카오톡 채널 1:1 대화창을 연다 — 고객이 채널로 직접 메시지를 보내도록 유도한다.
 * 고객이 채널로 메시지를 보내면 채널톡(카카오 채널 연동)으로 상담사에게 알림이 간다.
 * SDK 사용 불가 시 채널 채팅 URL(pf.kakao.com/_XXXXX/chat)을 새 창으로 연다.
 * 채널 ID 미설정이면 false.
 */
export async function openKakaoChannelChat(): Promise<boolean> {
  const id = channelPublicId();
  if (!id) {
    console.warn("[kakao] NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID 미설정");
    return false;
  }

  const kakao = await loadKakaoSdk();
  if (kakao?.Channel) {
    kakao.Channel.chat({ channelPublicId: id });
    return true;
  }

  window.open(`https://pf.kakao.com/${id}/chat`, "_blank", "noopener,noreferrer");
  return true;
}
