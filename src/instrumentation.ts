import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation hook — 서버/엣지 프로세스 시작 시 1회 실행된다.
// 1) 필수 환경변수 fail-fast 검증(loadEnv) — 운영에서 누락 시 throw 하여 부팅을 차단.
// 2) 런타임에 맞는 Sentry 설정을 로드하여 서버/엣지 에러 캡처를 활성화한다.
//    (DSN 미설정 시 각 config 가 init 을 건너뛰므로 안전.)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEnv } = await import("@/lib/env");
    loadEnv();
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Server Components / Route Handlers / 미들웨어(proxy) 에서 발생한 요청 에러를
// 자동으로 Sentry 로 전송한다. 라우트마다 try/catch 없이도 서버 에러가 잡힌다.
// (@sentry/nextjs v8.28+ / Next.js 15+)
export const onRequestError = Sentry.captureRequestError;
