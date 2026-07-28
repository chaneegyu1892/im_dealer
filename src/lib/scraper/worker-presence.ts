// 워커 생존 신호 — 관리자 화면에서 "지금 수집 PC 가 켜져 있는지"를 보여주기 위한 것.
//
// 워커가 폴링할 때마다 짧은 TTL 로 키를 갱신하고, 만료되면 자동으로 오프라인이 된다.
// 별도 정리 작업이나 DB 테이블이 필요 없고, 서버리스에서 프로세스 메모리를 못 쓰는 문제도 피한다.

import { Redis } from "@upstash/redis";

const KEY = "scraper:worker:last-seen";
// 신호는 두 곳에서 온다: 유휴 시 claim(기본 5초 주기), 작업 중 heartbeat(30초 주기).
// TTL 은 heartbeat 주기의 3배로 잡아 일시적 지연에 깜빡이지 않게 한다.
const TTL_SECONDS = 90;

function getRedis(): Redis | null {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv();
  }
  return null;
}

/** 워커가 살아 있음을 알린다. Redis 미설정이면 조용히 무시(로컬 개발). */
export async function markWorkerSeen(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(KEY, new Date().toISOString(), { ex: TTL_SECONDS });
}

export interface WorkerPresence {
  online: boolean;
  lastSeenAt: string | null;
  /** Redis 미설정이라 판정 자체가 불가능한 상태 — 화면에서 "확인 불가"로 구분한다. */
  unknown: boolean;
}

export async function getWorkerPresence(): Promise<WorkerPresence> {
  const redis = getRedis();
  if (!redis) return { online: false, lastSeenAt: null, unknown: true };

  const lastSeenAt = await redis.get<string>(KEY);
  return { online: lastSeenAt !== null, lastSeenAt: lastSeenAt ?? null, unknown: false };
}
