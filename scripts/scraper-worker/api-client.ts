import type { ScrapeDraft } from "../../src/types/scraper";

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
  productType: string;
  params: {
    trimIds: string[];
    vehicleId: string;
    lineupIds: string[];
    weekOf: string;
    minVehiclePrice: number;
    maxVehiclePrice: number;
  };
}

export interface ClaimedCredential {
  loginUrl: string;
  usernameEnc: string;
  passwordEnc: string;
  config: Record<string, unknown> | null;
  requiresHuman: boolean;
}

export async function claimJob(): Promise<{ job: ClaimedJob; credential: ClaimedCredential } | null> {
  const res = await fetch(`${BASE}/api/worker/scrape-jobs/claim`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`claim 실패: HTTP ${res.status}`);
  const data = (await res.json()) as
    | { job: null }
    | { job: ClaimedJob; credential: ClaimedCredential };
  if (!data.job) return null;
  return data as { job: ClaimedJob; credential: ClaimedCredential };
}

/** 하트비트 전송. 백엔드가 알려준 현재 status 를 반환 (cancel/resume 감지용). */
export async function heartbeat(
  jobId: string,
  body?: { status?: "running" | "needs_human"; humanPrompt?: string }
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
  result: { ok: true; draft: ScrapeDraft } | { ok: false; error: string; authFailed?: boolean }
): Promise<void> {
  const res = await fetch(`${BASE}/api/worker/scrape-jobs/${jobId}/result`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(result),
  });
  if (!res.ok) throw new Error(`result 실패: HTTP ${res.status}`);
}
