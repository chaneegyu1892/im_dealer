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

  // Admin auth (필수, 32자 이상)
  ADMIN_JWT_SECRET: z.string().min(32, "ADMIN_JWT_SECRET 은 32자 이상이어야 합니다."),
  ADMIN_ACCESS_TOKEN: z.string().min(32, "ADMIN_ACCESS_TOKEN 은 32자 이상이어야 합니다."),

  // IP 해싱
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT 은 16자 이상이어야 합니다."),

  // PII 컬럼 암호화 (CustomerVerification.licenseData/insuranceData/bizData/connectedId).
  // base64 32바이트(원본 길이 → base64 후 44자) 키. 분실 시 복구 불가.
  PII_ENCRYPTION_KEY: z
    .string()
    .min(44, "PII_ENCRYPTION_KEY 는 base64 32바이트(44자 이상) 이어야 합니다."),

  // 90일 PII 자동 만료 cron 호출 시 Bearer 토큰 검증용
  CRON_SECRET: z.string().min(32, "CRON_SECRET 은 32자 이상이어야 합니다."),

  // Optional integrations
  CODEF_CLIENT_ID: z.string().optional(),
  CODEF_CLIENT_SECRET: z.string().optional(),
  CODEF_SANDBOX: z.string().optional(),
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // 보안 설정
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const msg = `환경변수 검증 실패:\n${JSON.stringify(flat, null, 2)}`;
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

// 모듈 로드 시 즉시 검증을 수행하려면 아래를 활성화:
// loadEnv();
