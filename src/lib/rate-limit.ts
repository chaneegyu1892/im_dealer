import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// 캐시를 사용하여 동일 요청에 대한 속도를 높입니다. Edge 환경에서 유용합니다.
const cache = new Map();

// Redis 인스턴스를 환경변수 기반으로 안전하게 생성 (설정되지 않은 로컬 환경에서의 크래시 방지)
const getRedisInstance = () => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv();
  }
  return null;
};

const redis = getRedisInstance();

// 1. 일반 API용 속도 제한 (차량 목록/상세, 견적 조회·계산·저장, 비교 견적 등)
// 10초당 최대 40회 요청 허용 (Sliding Window 방식)
// 비교 차량 변경·옵션 변경 시 짧은 시간에 여러 호출이 눅되어도 정상 사용자는 걸리지 않도록 완화.
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(40, "10 s"),
      ephemeralCache: cache,
      analytics: true,
      prefix: "ratelimit:api",
    })
  : null;

// 2. 무거운/민감한 API용 속도 제한 (AI 추천, 이미지 생성, 파일 업로드)
// 1분당 최대 30회 요청 허용 (Token Bucket 방식)
// 단순 견적 계산은 여기서 제외(일반 apiRateLimit). 진짜 리소스 소모형만 보호.
export const strictRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(30, "1 m", 30),
      ephemeralCache: cache,
      analytics: true,
      prefix: "ratelimit:strict",
    })
  : null;

// 3. 어드민 로그인 — 5분당 최대 5회. 무차별 대입 방어.
export const loginRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "5 m"),
      ephemeralCache: cache,
      analytics: true,
      prefix: "ratelimit:login",
    })
  : null;

// 4. 후기 좋아요 토글 — 10초당 최대 10회. 익명 어브징 1차 방어.
export const likeRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      ephemeralCache: cache,
      analytics: true,
      prefix: "ratelimit:like",
    })
  : null;

// ─── 헬퍼: 라우트에서 rate limit 검사 ────────────────────
// limiter가 null(로컬 환경 등)이면 즉시 통과. Redis가 있으면 IP 기준으로 제한.
// 429 응답을 반환하거나, 통과 시 null 을 반환한다.
export async function checkRateLimit(
  request: NextRequest,
  limiter: Ratelimit | null,
  identifierSuffix?: string
): Promise<NextResponse | null> {
  if (!limiter) return null;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const identifier = identifierSuffix ? `${ip}:${identifierSuffix}` : ip;

  const { success } = await limiter.limit(identifier);
  if (!success) {
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }
  return null;
}
