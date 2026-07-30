import { describe, expect, it } from "vitest";
import {
  buildClaimLeaseWhere,
  canAcceptCatalogResults,
  getScrapeJobLeaseToken,
  isTerminalScrapeJobStatus,
} from "./job-state";

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
    const job = {
      status: "running",
      jobType: "catalog",
      financeCompanyId: "fc-1",
      productType: "장기렌트",
      params: {
        mode: "catalog",
        productType: "장기렌트",
        weekOf: "2026-07-20",
        brands: [{ brandCd: "B-1", name: "브랜드" }],
      },
    };
    const input = {
      financeCompanyId: "fc-1",
      productType: "장기렌트",
      weekOf: "2026-07-20",
      brandCds: ["B-1"],
    };
    expect(canAcceptCatalogResults(job, input)).toBe(true);
    expect(canAcceptCatalogResults({ ...job, status: "completed" }, input)).toBe(false);
    expect(canAcceptCatalogResults(job, { ...input, financeCompanyId: "fc-2" })).toBe(false);
    expect(canAcceptCatalogResults(job, { ...input, productType: "리스" })).toBe(false);
    expect(canAcceptCatalogResults(job, { ...input, weekOf: "2026-07-13" })).toBe(false);
    expect(canAcceptCatalogResults(job, { ...input, brandCds: ["B-OUTSIDE"] })).toBe(false);
  });

  it("accepts only server-issued UUID lease tokens", () => {
    const request = (value: string | null) => ({ headers: { get: () => value } });
    expect(getScrapeJobLeaseToken(request("25db3703-3c79-4b91-a138-b95cf86b4151"))).toBe(
      "25db3703-3c79-4b91-a138-b95cf86b4151"
    );
    expect(getScrapeJobLeaseToken(request("guessable-token"))).toBeNull();
    expect(getScrapeJobLeaseToken(request(null))).toBeNull();
  });
});
