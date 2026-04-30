import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!dsn && process.env.NODE_ENV === "production") {
  // 운영에서 DSN 누락은 옵저버빌리티 공백을 의미한다. 시작 차단.
  throw new Error("[Sentry] NEXT_PUBLIC_SENTRY_DSN 이 설정되지 않았습니다.");
}

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    debug: false,
    environment: process.env.NODE_ENV,
  });
}
