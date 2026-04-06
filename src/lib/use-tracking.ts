"use client";

import { useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

const SESSION_KEY = "imd_session_id";

/** 브라우저 세션 ID 가져오기 (없으면 생성) */
function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

type EventType =
  | "page_view"
  | "car_click"
  | "filter_apply"
  | "quote_start"
  | "quote_complete"
  | "chat_click"
  | "recommend_start"
  | "recommend_complete";

interface TrackEventOptions {
  vehicleId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 탐색 이벤트 트래킹 훅
 *
 * @example
 * const { track } = useTracking();
 * track("car_click", { vehicleId: "abc", metadata: { slug: "ioniq6" } });
 */
export function useTracking() {
  // 중복 이벤트 방지용 마지막 이벤트 ref
  const lastEvent = useRef<string>("");

  const track = useCallback(
    async (
      eventType: EventType,
      options: TrackEventOptions = {}
    ): Promise<void> => {
      // page_view 중복 전송 방지
      const key = `${eventType}:${options.vehicleId ?? ""}:${typeof window !== "undefined" ? window.location.pathname : ""}`;
      if (eventType === "page_view" && key === lastEvent.current) return;
      lastEvent.current = key;

      try {
        await fetch("/api/logs/exploration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: getSessionId(),
            eventType,
            path: typeof window !== "undefined" ? window.location.pathname : undefined,
            vehicleId: options.vehicleId,
            metadata: options.metadata,
          }),
          // keepalive: 페이지 이탈 시에도 요청 완료 보장
          keepalive: true,
        });
      } catch {
        // 트래킹 실패는 사용자 경험에 영향 주지 않음
      }
    },
    []
  );

  /** 추천 결과 차량 클릭 기록 */
  const trackRecommendClick = useCallback(
    async (vehicleId: string, proceedToQuote = false): Promise<void> => {
      try {
        await fetch("/api/logs/recommendation-click", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: getSessionId(),
            vehicleId,
            proceedToQuote,
          }),
          keepalive: true,
        });
      } catch {
        // 조용히 실패
      }
    },
    []
  );

  /** 견적 조회 기록 */
  const trackQuoteView = useCallback(
    async (
      vehicleId: string,
      slug: string,
      opts?: { contractMonths?: number; annualMileage?: number; scenario?: string }
    ): Promise<void> => {
      try {
        await fetch("/api/logs/quote-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: getSessionId(),
            vehicleId,
            slug,
            ...opts,
          }),
          keepalive: true,
        });
      } catch {
        // 조용히 실패
      }
    },
    []
  );

  return { track, trackRecommendClick, trackQuoteView, getSessionId };
}
