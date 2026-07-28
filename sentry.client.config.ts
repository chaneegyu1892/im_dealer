import * as Sentry from "@sentry/nextjs";
import {
  scrubEvent,
  scrubSpan,
  scrubTransaction,
} from "@/lib/sentry-before-send";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    debug: false,
    environment: process.env.NODE_ENV,
    // 클라이언트에서도 동일 마스킹 적용 (사용자 입력이 에러 컨텍스트에 포함될 수 있음).
    beforeSend: scrubEvent,
    // 샘플링된 transaction/span에도 후기 bearer URL이 남지 않도록 동일 경계 적용.
    beforeSendTransaction: scrubTransaction,
    beforeSendSpan: scrubSpan,
  });
}
