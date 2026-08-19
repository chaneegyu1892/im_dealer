import { z } from "zod";

/**
 * 시작 시 환경변수 검증.
 * - 운영(production)에서는 누락 시 throw 하여 컨테이너 부팅을 차단한다.
 * - 개발 환경에서는 경고만 출력하고 통과한다.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // 네이버 서치어드바이저 소유확인 meta 태그의 content 값
  NAVER_SITE_VERIFICATION: z.string().min(1).optional(),

  // IP 해싱
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT 은 16자 이상이어야 합니다."),

  // PII 컬럼 암호화 (CustomerVerification.licenseData/insuranceData/bizData/connectedId).
  // base64 32바이트(원본 길이 → base64 후 44자) 키. 분실 시 복구 불가.
  PII_ENCRYPTION_KEY: z
    .string()
    .min(44, "PII_ENCRYPTION_KEY 는 base64 32바이트(44자 이상) 이어야 합니다."),

  // 90일 PII 자동 만료 cron 호출 시 Bearer 토큰 검증용
  CRON_SECRET: z.string().min(32, "CRON_SECRET 은 32자 이상이어야 합니다."),

  // PII 평문 레거시 거부 스위치 — encrypt-existing-pii.ts 백필 + --check 0건 확인 후 true 로.
  PII_REJECT_PLAINTEXT: z.enum(["true", "false"]).optional(),

  // Optional integrations
  CODEF_CLIENT_ID: z.string().optional(),
  CODEF_CLIENT_SECRET: z.string().optional(),
  CODEF_SANDBOX: z.string().optional(),
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // 보안 설정
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),

  // CI E2E 전용 옵트아웃 — 격리된 테스트 런타임은 Upstash 없이 구동한다.
  // Vercel 배포(VERCEL=1)에서는 무시되므로 운영에서 실수로 켤 수 없다.
  E2E_ALLOW_MISSING_RATE_LIMIT: z.enum(["true", "false"]).optional(),
})
  // 운영 런타임에선 rate limit 을 위한 Upstash 가 필수다. 누락되면 모든 제한이
  // fail-open 으로 사라진다. next build 시점(NEXT_PHASE=phase-production-build)은 제외.
  .superRefine((val, ctx) => {
    // CI E2E 는 Upstash 없이 도는 격리 런타임이라 면제한다. 단 Vercel 배포에서는
    // 플래그를 무시해, 운영에서 rate limit 이 조용히 사라지는 길을 남기지 않는다.
    const e2eExempt =
      val.E2E_ALLOW_MISSING_RATE_LIMIT === "true" && process.env.VERCEL !== "1";
    if (
      val.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build" &&
      !e2eExempt
    ) {
      const missing: string[] = [];
      if (!val.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
      if (!val.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `운영에서는 rate limit 용 ${missing.join(", ")} 이(가) 필수입니다.`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // fieldErrors 만 찍으면 path 없는 superRefine 이슈(formErrors)가 통째로 사라져
    // '{}' 만 남는다. 값은 절대 싣지 않고 키 이름과 사유만 노출한다.
    const { fieldErrors, formErrors } = parsed.error.flatten();
    const reasons = [
      ...formErrors,
      ...Object.entries(fieldErrors).map(
        ([key, errors]) => `${key}: ${(errors ?? []).join(", ")}`
      ),
    ];
    const msg = `환경변수 검증 실패:\n${reasons.map((line) => `- ${line}`).join("\n")}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.warn(`[env] ${msg}`);
    // 개발에서는 빈 기본값 캐시 — 실제 사용처에서 다시 검증.
    cached = envSchema.parse({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" });
    return cached;
  }
  cached = parsed.data;
  return cached;
}

// 서버 시작 시 검증은 src/instrumentation.ts 의 register() 에서 loadEnv() 호출로 수행한다.
// (운영에서 필수 키 누락 시 throw → 컨테이너 부팅 차단)
