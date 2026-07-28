const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);

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
}

export function canAcceptCatalogResults(
  job: CatalogJobContext,
  input: Pick<CatalogJobContext, "financeCompanyId" | "productType">
): boolean {
  return (
    job.status === "running" &&
    job.jobType === "catalog" &&
    job.financeCompanyId === input.financeCompanyId &&
    job.productType === input.productType
  );
}
