const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);

export const SCRAPE_JOB_LEASE_TOKEN_HEADER = "x-scrape-job-lease-token";

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
