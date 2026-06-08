import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-before-send";

// Edge 런타임(미들웨어 src/proxy.ts 등)에서 발생하는 에러 캡처.
// DSN 미설정 시 비활성 — server config 와 동일하게 부팅을 차단하지 않는다.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    debug: false,
    environment: process.env.NODE_ENV,
    beforeSend: scrubEvent,
  });
}
