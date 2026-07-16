import { describe, expect, it } from "vitest";
import { buildClaimLeaseWhere, canAcceptCatalogResults, isTerminalScrapeJobStatus } from "./job-state";

describe("scrape job state guards", () => {
  it("binds stale reclaims to the stale heartbeat observed during selection", () => {
    const cutoff = new Date("2026-07-16T20:00:00.000Z");
    expect(buildClaimLeaseWhere({ id: "job-1", status: "running" }, cutoff)).toEqual({
      id: "job-1",
      status: "running",
      heartbeatAt: { lt: cutoff },
    });
    expect(buildClaimLeaseWhere({ id: "job-2", status: "pending" }, cutoff)).toEqual({
      id: "job-2",
      status: "pending",
    });
  });

  it("treats every terminal state as immutable", () => {
    expect(["completed", "failed", "canceled"].every(isTerminalScrapeJobStatus)).toBe(true);
    expect(isTerminalScrapeJobStatus("running")).toBe(false);
  });

  it("accepts catalog batches only for the matching running job context", () => {
    const job = { status: "running", jobType: "catalog", financeCompanyId: "fc-1", productType: "장기렌트" };
    expect(canAcceptCatalogResults(job, { financeCompanyId: "fc-1", productType: "장기렌트" })).toBe(true);
    expect(canAcceptCatalogResults({ ...job, status: "completed" }, { financeCompanyId: "fc-1", productType: "장기렌트" })).toBe(false);
    expect(canAcceptCatalogResults(job, { financeCompanyId: "fc-2", productType: "장기렌트" })).toBe(false);
  });
});
