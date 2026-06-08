import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!dsn) {
  // DSN 미설정 시 Sentry 는 비활성(에러 미수집)된다.
  // 모니터링은 요청 처리 경로가 아니므로, 누락됐다고 부팅을 차단하지(throw) 않는다.
  // — 관측성 공백보다 "모니터링 미설정이 서비스 전체를 다운시키는" 쪽이 더 큰 가용성 위험이다.
  // DSN 을 설정하면 별도 코드 변경 없이 자동 활성화된다.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[Sentry] NEXT_PUBLIC_SENTRY_DSN 미설정 — 서버 에러 모니터링이 비활성 상태입니다."
    );
  }
} else {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    debug: false,
    environment: process.env.NODE_ENV,
    // 한국 PII 가 외부로 전송되기 전 마스킹 (server/edge/client 공통 헬퍼).
    beforeSend: scrubEvent,
  });
}
