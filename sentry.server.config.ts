import * as Sentry from "@sentry/nextjs";
import { scrubPII } from "@/lib/sentry-scrubber";

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
    // 한국 PII (휴대폰/사업자번호/면허번호/주민번호/이메일) 가 외부로 전송되기 전 마스킹.
    // 키 기반(licenseData, connectedId, passwordHash 등) + 패턴 기반 두 단계.
    beforeSend(event) {
      if (event.request?.data !== undefined) {
        event.request.data = scrubPII(event.request.data);
      }
      if (event.request?.cookies) {
        event.request.cookies = scrubPII(event.request.cookies) as typeof event.request.cookies;
      }
      if (event.request?.headers) {
        event.request.headers = scrubPII(event.request.headers) as typeof event.request.headers;
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
