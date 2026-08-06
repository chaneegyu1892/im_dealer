"use client";

import { useEffect, useState } from "react";
import { buildEscapeUrl, isKakaoTalkInApp } from "@/lib/browser/in-app";

interface KakaoTalkInAppState {
  /** 카카오톡 인앱브라우저 여부. 마운트 전에는 항상 false. */
  readonly isInApp: boolean;
  /** 외부 브라우저로 빠져나가는 URL. 불가능한 조합이면 null. */
  readonly escapeUrl: string | null;
}

const INACTIVE: KakaoTalkInAppState = { isInApp: false, escapeUrl: null };

/**
 * 카카오톡 인앱브라우저 여부와 탈출 URL 을 돌려준다.
 *
 * 서버 렌더와 첫 클라이언트 렌더가 일치해야 하므로 판별은 마운트 이후에만 한다.
 * 그 전까지는 일반 브라우저와 같은 값을 돌려준다.
 */
export function useKakaoTalkInApp(): KakaoTalkInAppState {
  const [state, setState] = useState<KakaoTalkInAppState>(INACTIVE);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    if (!isKakaoTalkInApp(userAgent)) return;

    setState({
      isInApp: true,
      escapeUrl: buildEscapeUrl(window.location.href, userAgent),
    });
  }, []);

  return state;
}
