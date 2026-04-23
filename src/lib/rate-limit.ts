import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

// 1. 일반 API용 속도 제한 (예: 차량 목록/상세 조회)
// 10초당 최대 20회 요청 허용 (Sliding Window 방식)
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 s"),
      ephemeralCache: cache,
      analytics: true,
      prefix: "ratelimit:api",
    })
  : null;

// 2. 견적 계산 및 AI 추천 등 무거운/민감한 API용 속도 제한
// 1분당 최대 5회 요청 허용 (Token Bucket 방식)
export const strictRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(5, "1 m", 5),
      ephemeralCache: cache,
      analytics: true,
      prefix: "ratelimit:strict",
    })
  : null;
