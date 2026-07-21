import type { CatalogProgress, CatalogScrapeSummary, CatalogTrimEntry, ScrapeDraft, ScrapeJobType } from "../../src/types/scraper";

/** 백엔드 워커 라우트와 통신하는 얇은 fetch 래퍼 (Bearer 시크릿). */

const BASE = process.env.WORKER_API_BASE ?? "http://localhost:3000";
const SECRET = process.env.SCRAPER_WORKER_SECRET ?? "";

function headers() {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${SECRET}`,
  };
}

export interface ClaimedJob {
  id: string;
  financeCompanyId: string;
  jobType: ScrapeJobType;
  productType: string;
  params: Record<string, unknown>; // trim_rates: ScrapeJobParams / catalog: CatalogJobParams
}

export interface ClaimedCredential {
  loginUrl: string;
  usernameEnc: string;
  passwordEnc: string;
  config: Record<string, unknown> | null;
  requiresHuman: boolean;
}

export interface ClaimResult {
  job: ClaimedJob | null;
  credential: ClaimedCredential | null;
  /** 백엔드가 기대하는 워커 버전. 구버전 백엔드면 undefined. */
  expectedWorkerVersion?: number;
}

export async function claimJob(): Promise<ClaimResult> {
  const res = await fetch(`${BASE}/api/worker/scrape-jobs/claim`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`claim 실패: HTTP ${res.status}`);
  const data = (await res.json()) as {
    job: ClaimedJob | null;
    credential?: ClaimedCredential;
    expectedWorkerVersion?: number;
  };
  return {
    job: data.job ?? null,
    credential: data.credential ?? null,
    expectedWorkerVersion: data.expectedWorkerVersion,
  };
}

/** 하트비트 전송. 백엔드가 알려준 현재 status 를 반환 (cancel/resume 감지용). */
export async function heartbeat(
  jobId: string,
  body?: { status?: "running" | "needs_human"; humanPrompt?: string; progress?: CatalogProgress }
): Promise<string> {
  const res = await fetch(`${BASE}/api/worker/scrape-jobs/${jobId}/heartbeat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`heartbeat 실패: HTTP ${res.status}`);
  const data = (await res.json()) as { status: string };
  return data.status;
}

export async function postResult(
  jobId: string,
  result:
    | { ok: true; draft: ScrapeDraft }
    | { ok: true; catalogSummary: CatalogScrapeSummary }
    | { ok: false; error: string; authFailed?: boolean }
): Promise<void> {
  const res = await fetch(`${BASE}/api/worker/scrape-jobs/${jobId}/result`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error(`result 실패: HTTP ${res.status}`);
}

/** catalog 잡 증분 결과 flush (모델 경계/20건 단위). */
export async function postCatalogResults(body: {
  jobId: string;
  financeCompanyId: string;
  productType: string;
  weekOf: string;
  entries: CatalogTrimEntry[];
}): Promise<void> {
  const res = await fetch(`${BASE}/api/worker/catalog/results`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`catalog results 실패: HTTP ${res.status}`);
}

/** 이번주 이미 수집된 외부 트림코드 목록 (재개 시 스킵 판정). */
export async function getCollectedMdelCds(
  financeCompanyId: string,
  productType: string,
  weekOf: string
): Promise<string[]> {
  const qs = new URLSearchParams({ financeCompanyId, productType, weekOf });
  const res = await fetch(`${BASE}/api/worker/catalog/collected?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`catalog collected 실패: HTTP ${res.status}`);
  const data = (await res.json()) as { mdelCds: string[] };
  return data.mdelCds ?? [];
}
