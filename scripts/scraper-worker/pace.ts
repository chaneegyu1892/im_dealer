/**
 * 수집 속도(요청 간 지연·셀 병렬도)를 한 곳에서 관리한다.
 *
 * 기본값은 **빠름**. 계정 차단·레이트리밋이 우려되는 상황에서는 `SCRAPER_PACE=safe` 로
 * 예전 기본값(사람 속도 모사: 요청당 0.4~0.7초 + 셀 순차)으로 되돌린다.
 * 캐피탈사별 config 에 requestDelayMs / cellConcurrency 가 있으면 그 값이 언제나 우선한다.
 */

export const SAFE_PACE = process.env.SCRAPER_PACE === "safe";

/** 빠름 모드의 요청 간 기본 지연(ms). 0 은 아니라 최소한의 간격은 남긴다. */
const FAST_REQUEST_DELAY_MS = 120;
/** 빠름 모드에서 트림 1건의 기간×거리 셀을 동시에 처리하는 수. */
const FAST_CELL_CONCURRENCY = 3;

export const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve();

export const rand = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo));

function cfgNum(config: Record<string, unknown> | null, key: string): number | null {
  const v = config?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * 요청 간 지연(ms) — 랜덤 지터 +0~60% 포함.
 * @param safeBase SCRAPER_PACE=safe 일 때 쓸 기존 기본값(어댑터마다 다름).
 */
export function reqDelay(config: Record<string, unknown> | null, safeBase: number): number {
  const base = cfgNum(config, "requestDelayMs") ?? (SAFE_PACE ? safeBase : FAST_REQUEST_DELAY_MS);
  return base <= 0 ? 0 : base + rand(0, Math.floor(base * 0.6));
}

/** 트림 1건의 셀(기간×거리) 동시 처리 수. safe 모드는 1(순차) — 예전 동작. */
export function cellConcurrency(config: Record<string, unknown> | null): number {
  const v = cfgNum(config, "cellConcurrency");
  return Math.max(1, v ?? (SAFE_PACE ? 1 : FAST_CELL_CONCURRENCY));
}

/** 동시 실행 수를 제한한 map. 결과는 입력 순서를 유지한다. */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return out;
}
