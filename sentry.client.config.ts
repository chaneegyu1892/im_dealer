import * as Sentry from "@sentry/nextjs";
import { scrubPII } from "@/lib/sentry-scrubber";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    debug: false,
    environment: process.env.NODE_ENV,
    // 클라이언트에서도 동일 마스킹 적용 (사용자 입력이 에러 컨텍스트에 포함될 수 있음).
    beforeSend(event) {
      if (event.request?.data !== undefined) {
        event.request.data = scrubPII(event.request.data);
      }
      if (event.extra) {
        event.extra = scrubPII(event.extra) as Record<string, unknown>;
      }
      if (event.contexts) {
        event.contexts = scrubPII(event.contexts) as typeof event.contexts;
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          data: b.data ? (scrubPII(b.data) as Record<string, unknown>) : b.data,
          message: b.message ? (scrubPII(b.message) as string) : b.message,
        }));
      }
      return event;
    },
  });
}
