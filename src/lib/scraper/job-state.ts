const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);

export const SCRAPE_JOB_LEASE_TOKEN_HEADER = "x-scrape-job-lease-token";

export const SCRAPE_JOB_WORKER_ID_HEADER = "x-worker-id";

/** 수집 PC 이름. 사람이 화면에 입력하는 값이라 짧고 단순한 문자만 받는다. */
export const WORKER_ID_PATTERN = /^[A-Za-z0-9가-힣_-]{1,32}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getScrapeJobLeaseToken(request: {
  headers: { get(name: string): string | null };
}): string | null {
  const token = request.headers.get(SCRAPE_JOB_LEASE_TOKEN_HEADER);
  return token && UUID_PATTERN.test(token) ? token : null;
}

export function isTerminalScrapeJobStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * 클레임 요청이 밝힌 워커 이름. 형식에 안 맞으면 이름 없는 워커로 취급한다.
 * 한글 이름은 HTTP 헤더에 못 실려 워커가 percent-인코딩해 보낸다 — 여기서 복원한다.
 * (영문 이름은 인코딩 전후가 같아 구버전 워커도 그대로 통과한다)
 */
export function getClaimWorkerId(request: {
  headers: { get(name: string): string | null };
}): string | null {
  const raw = request.headers.get(SCRAPE_JOB_WORKER_ID_HEADER)?.trim();
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null; // 깨진 인코딩 = 이름 없는 워커 취급
  }
  return WORKER_ID_PATTERN.test(decoded) ? decoded : null;
}

/**
 * 워커가 집어도 되는 작업의 범위.
 *
 * 이름이 있는 워커는 자기 몫 + 미지정 작업을, 이름 없는 워커는 미지정 작업만 집는다.
 * 지정된 작업이 엉뚱한 워커에게 가면 그 PC 에서 남의 캐피탈 계정이 복호화되므로,
 * 하트비트가 끊긴 작업 회수에도 같은 제한이 그대로 걸린다.
 */
export function buildClaimWorkerWhere(workerId: string | null) {
  return workerId
    ? { OR: [{ workerId }, { workerId: null }] }
    : { workerId: null };
}

export function buildClaimLeaseWhere(
  candidate: { id: string; status: string },
  staleCutoff: Date
) {
  if (candidate.status === "pending") {
    return { id: candidate.id, status: "pending" } as const;
  }
  return {
    id: candidate.id,
    status: candidate.status,
    heartbeatAt: { lt: staleCutoff },
  };
}

interface CatalogJobContext {
  status: string;
  jobType: string;
  financeCompanyId: string;
  productType: string;
  params: unknown;
}

export function canAcceptCatalogResults(
  job: CatalogJobContext,
  input: Pick<CatalogJobContext, "financeCompanyId" | "productType"> & {
    weekOf: string;
    brandCds: readonly string[];
  }
): boolean {
  if (!job.params || typeof job.params !== "object" || Array.isArray(job.params)) {
    return false;
  }
  const params = job.params as Record<string, unknown>;
  if (
    params.mode !== "catalog" ||
    typeof params.weekOf !== "string" ||
    typeof params.productType !== "string" ||
    !Array.isArray(params.brands)
  ) {
    return false;
  }
  const allowedBrandCds = new Set<string>();
  for (const brand of params.brands) {
    if (!brand || typeof brand !== "object" || Array.isArray(brand)) return false;
    const brandCd = (brand as Record<string, unknown>).brandCd;
    if (typeof brandCd !== "string" || !brandCd) return false;
    allowedBrandCds.add(brandCd);
  }
  if (allowedBrandCds.size === 0) return false;

  return (
    job.status === "running" &&
    job.jobType === "catalog" &&
    job.financeCompanyId === input.financeCompanyId &&
    job.productType === input.productType &&
    params.productType === input.productType &&
    params.weekOf === input.weekOf &&
    input.brandCds.every((brandCd) => allowedBrandCds.has(brandCd))
  );
}

/**
 * models 잡의 차량 목록 저장을 받아도 되는지.
 * catalog 판정과 같은 기준이되 weekOf 가 없다(목록은 주 단위 스냅샷이 아니라 현재 상태다).
 */
export function canAcceptModelResults(
  job: CatalogJobContext,
  input: Pick<CatalogJobContext, "financeCompanyId" | "productType"> & { brandCds: readonly string[] }
): boolean {
  if (!job.params || typeof job.params !== "object" || Array.isArray(job.params)) {
    return false;
  }
  const params = job.params as Record<string, unknown>;
  if (params.mode !== "models" || typeof params.productType !== "string" || !Array.isArray(params.brands)) {
    return false;
  }
  const allowedBrandCds = new Set<string>();
  for (const brand of params.brands) {
    if (!brand || typeof brand !== "object" || Array.isArray(brand)) return false;
    const brandCd = (brand as Record<string, unknown>).brandCd;
    if (typeof brandCd !== "string" || !brandCd) return false;
    allowedBrandCds.add(brandCd);
  }
  if (allowedBrandCds.size === 0) return false;

  return (
    job.status === "running" &&
    job.jobType === "models" &&
    job.financeCompanyId === input.financeCompanyId &&
    job.productType === input.productType &&
    params.productType === input.productType &&
    input.brandCds.every((brandCd) => allowedBrandCds.has(brandCd))
  );
}
