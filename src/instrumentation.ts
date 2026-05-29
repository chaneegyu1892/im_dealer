// Next.js instrumentation hook — 서버 프로세스 시작 시 1회 실행된다.
// 운영(production)에서 필수 환경변수(PII_ENCRYPTION_KEY / CRON_SECRET / IP_HASH_SALT 등)가
// 누락되면 loadEnv() 가 throw 하여 부팅을 차단(fail-fast)한다. 개발 환경에서는 경고만 출력.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEnv } = await import("@/lib/env");
    loadEnv();
  }
}
