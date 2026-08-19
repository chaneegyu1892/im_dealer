import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * loadEnv() 는 모듈 스코프에 결과를 캐시하므로 케이스마다 resetModules 가 필요하다.
 * process.env 는 전역이라 이 테스트가 건드리는 키만 골라 저장/복원한다.
 */
const MANAGED_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "IP_HASH_SALT",
  "PII_ENCRYPTION_KEY",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PHASE",
  "VERCEL",
  "E2E_ALLOW_MISSING_RATE_LIMIT",
] as const;

// superRefine 이외의 필드는 전부 통과하는 최소 집합.
const VALID_BASE: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-0123456789abcdef",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  IP_HASH_SALT: "test-ip-hash-salt-0123456789",
  PII_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CRON_SECRET: "test-cron-secret-0123456789abcdef0123456789",
};

// NODE_ENV 는 타입상 readonly 라 인덱스 시그니처를 통해 쓴다.
const mutableEnv = process.env as Record<string, string | undefined>;

const snapshot = new Map(MANAGED_KEYS.map((key) => [key, mutableEnv[key]]));

function applyEnv(overrides: Record<string, string | undefined>): void {
  for (const key of MANAGED_KEYS) delete mutableEnv[key];
  for (const [key, value] of Object.entries({ ...VALID_BASE, ...overrides })) {
    if (value !== undefined) mutableEnv[key] = value;
  }
}

async function loadEnvFresh() {
  vi.resetModules();
  const { loadEnv } = await import("./env");
  return loadEnv();
}

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    const original = snapshot.get(key);
    if (original === undefined) delete mutableEnv[key];
    else mutableEnv[key] = original;
  }
});

describe("loadEnv - 운영 rate limit 필수 검증", () => {
  it("Upstash 키가 있으면 통과한다", async () => {
    applyEnv({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "upstash-token",
    });
    await expect(loadEnvFresh()).resolves.toMatchObject({ NODE_ENV: "production" });
  });

  it("Upstash 키가 없으면 운영 부팅을 차단한다", async () => {
    applyEnv({});
    await expect(loadEnvFresh()).rejects.toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("실패 메시지에 누락된 키 이름이 드러난다 (formErrors 유실 방지)", async () => {
    applyEnv({});
    // flatten().fieldErrors 만 출력하면 path 없는 superRefine 이슈가 사라져 '{}' 만 남는다.
    await expect(loadEnvFresh()).rejects.toThrow(/UPSTASH_REDIS_REST_TOKEN/);
  });

  it("빌드 단계(NEXT_PHASE)에서는 Upstash 키 없이 통과한다", async () => {
    applyEnv({ NEXT_PHASE: "phase-production-build" });
    await expect(loadEnvFresh()).resolves.toMatchObject({ NODE_ENV: "production" });
  });

  it("E2E 옵트아웃 플래그가 켜지면 Upstash 키 없이 통과한다", async () => {
    applyEnv({ E2E_ALLOW_MISSING_RATE_LIMIT: "true" });
    await expect(loadEnvFresh()).resolves.toMatchObject({ NODE_ENV: "production" });
  });

  it("Vercel 배포에서는 E2E 옵트아웃 플래그를 무시하고 차단한다", async () => {
    applyEnv({ E2E_ALLOW_MISSING_RATE_LIMIT: "true", VERCEL: "1" });
    await expect(loadEnvFresh()).rejects.toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("옵트아웃 플래그가 'true' 가 아니면 차단한다", async () => {
    applyEnv({ E2E_ALLOW_MISSING_RATE_LIMIT: "false" });
    await expect(loadEnvFresh()).rejects.toThrow(/UPSTASH_REDIS_REST_URL/);
  });
});
