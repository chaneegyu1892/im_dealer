import type { CatalogProgress, CatalogScrapeSummary, CatalogTrimEntry, ModelsJobSummary, ScrapeDraft, ScrapeJobType } from "../../src/types/scraper";
import { SCRAPE_JOB_LEASE_TOKEN_HEADER, SCRAPE_JOB_WORKER_ID_HEADER } from "../../src/lib/scraper/job-state";
import { WORKER_PROTOCOL_VERSION } from "../../src/lib/scraper/worker-version";

/** 백엔드 워커 라우트와 통신하는 얇은 fetch 래퍼 (Bearer 시크릿).
 *
 * 워커 하나가 여러 서버(운영·테스트)를 동시에 섬길 수 있도록,
 * 서버 주소별로 클라이언트를 만들어 쓴다(createApiClient). 시크릿·워커 이름은
 * 모든 서버가 같은 값을 쓴다는 전제(운영 정책)라 공유한다.
 */

const SECRET = process.env.SCRAPER_WORKER_SECRET ?? "";
const WORKER_ID = process.env.SCRAPER_WORKER_ID?.trim() ?? "";

/** WORKER_API_BASE 파싱 — 쉼표 구분 여러 주소 허용, 공백·끝 슬래시 정리, 중복 제거. */
export function parseApiBases(raw: string | undefined): string[] {
  return [...new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  )];
}

function headers(leaseToken?: string) {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${SECRET}`,
    "x-worker-protocol-version": String(WORKER_PROTOCOL_VERSION),
    ...(leaseToken ? { [SCRAPE_JOB_LEASE_TOKEN_HEADER]: leaseToken } : {}),
  };
}

export interface ClaimedJob {
  id: string;
  leaseToken: string;
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

export type ApiClient = ReturnType<typeof createApiClient>;

/** 서버 주소 하나에 묶인 API 클라이언트를 만든다. */
export function createApiClient(base: string) {
  const BASE = base.replace(/\/+$/, "");

  async function claimJob(): Promise<ClaimResult> {
    const res = await fetch(`${BASE}/api/worker/scrape-jobs/claim`, {
      method: "POST",
      // 이름을 밝히면 자기 몫으로 지정된 작업까지 받는다. 비우면 미지정 작업만.
      // HTTP 헤더에는 한글이 못 실린다(ByteString) — percent-인코딩해 보내고 서버가 복원한다.
      headers: { ...headers(), ...(WORKER_ID ? { [SCRAPE_JOB_WORKER_ID_HEADER]: encodeURIComponent(WORKER_ID) } : {}) },
    });
    if (res.status === 409) {
      const incompatibility = (await res.json()) as {
        error?: string;
        expectedWorkerVersion?: number;
      };
      if (
        incompatibility.error === "worker_protocol_version_incompatible" &&
        typeof incompatibility.expectedWorkerVersion === "number"
      ) {
        return {
          job: null,
          credential: null,
          expectedWorkerVersion: incompatibility.expectedWorkerVersion,
        };
      }
    }
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
  async function heartbeat(
    jobId: string,
    leaseToken: string,
    body?: { status?: "running" | "needs_human"; humanPrompt?: string; progress?: CatalogProgress }
  ): Promise<string> {
    const res = await fetch(`${BASE}/api/worker/scrape-jobs/${jobId}/heartbeat`, {
      method: "POST",
      headers: headers(leaseToken),
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) throw new Error(`heartbeat 실패: HTTP ${res.status}`);
    const data = (await res.json()) as { status: string };
    return data.status;
  }

  async function postResult(
    jobId: string,
    leaseToken: string,
    result:
      | { ok: true; draft: ScrapeDraft }
      | { ok: true; catalogSummary: CatalogScrapeSummary }
      | { ok: true; modelsSummary: ModelsJobSummary }
      | { ok: false; error: string; authFailed?: boolean }
  ): Promise<void> {
    const res = await fetch(`${BASE}/api/worker/scrape-jobs/${jobId}/result`, {
      method: "POST",
      headers: headers(leaseToken),
      body: JSON.stringify(result),
    });
    if (!res.ok) throw new Error(`result 실패: HTTP ${res.status}`);
  }

  /** catalog 잡 증분 결과 flush (모델 경계/5건 단위). ignored=취소된 잡이라 서버가 버림. */
  async function postCatalogResults(body: {
    jobId: string;
    leaseToken: string;
    financeCompanyId: string;
    productType: string;
    weekOf: string;
    entries: CatalogTrimEntry[];
  }): Promise<{ ignored: boolean }> {
    const { leaseToken, ...payload } = body;
    const res = await fetch(`${BASE}/api/worker/catalog/results`, {
      method: "POST",
      headers: headers(leaseToken),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`catalog results 실패: HTTP ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as { ignored?: boolean };
    return { ignored: data.ignored === true };
  }

  /** models 잡: 브랜드 1개분 차량 목록 저장. */
  async function postModelResults(body: {
    jobId: string;
    leaseToken: string;
    financeCompanyId: string;
    productType: string;
    brandCd: string;
    brandName: string;
    models: { modelCd: string; modelName: string }[];
  }): Promise<void> {
    const { leaseToken, ...payload } = body;
    const res = await fetch(`${BASE}/api/worker/catalog/models`, {
      method: "POST",
      headers: headers(leaseToken),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`models results 실패: HTTP ${res.status}`);
  }

  /** 이번주 이미 수집된 외부 트림코드 목록 (재개 시 스킵 판정). */
  async function getCollectedMdelCds(
    jobId: string,
    leaseToken: string,
    financeCompanyId: string,
    productType: string,
    weekOf: string
  ): Promise<string[]> {
    const qs = new URLSearchParams({ jobId, financeCompanyId, productType, weekOf });
    const res = await fetch(`${BASE}/api/worker/catalog/collected?${qs}`, {
      headers: headers(leaseToken),
    });
    if (!res.ok) throw new Error(`catalog collected 실패: HTTP ${res.status}`);
    const data = (await res.json()) as { mdelCds: string[] };
    return data.mdelCds ?? [];
  }

  return { base: BASE, claimJob, heartbeat, postResult, postCatalogResults, postModelResults, getCollectedMdelCds };
}
