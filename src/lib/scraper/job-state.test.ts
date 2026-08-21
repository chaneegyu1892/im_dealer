import { describe, expect, it } from "vitest";
import {
  buildClaimLeaseWhere,
  canAcceptCatalogResults,
  canAcceptModelResults,
  getClaimWorkerId,
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

  it("binds model list results to the models job that requested those brands", () => {
    const job = {
      status: "running",
      jobType: "models",
      financeCompanyId: "fc-1",
      productType: "장기렌트",
      params: {
        mode: "models",
        productType: "장기렌트",
        brands: [{ brandCd: "B-1", name: "브랜드" }],
      },
    };
    const input = { financeCompanyId: "fc-1", productType: "장기렌트", brandCds: ["B-1"] };

    expect(canAcceptModelResults(job, input)).toBe(true);
    expect(canAcceptModelResults({ ...job, status: "completed" }, input)).toBe(false);
    expect(canAcceptModelResults(job, { ...input, financeCompanyId: "fc-2" })).toBe(false);
    expect(canAcceptModelResults(job, { ...input, productType: "리스" })).toBe(false);
    expect(canAcceptModelResults(job, { ...input, brandCds: ["B-OUTSIDE"] })).toBe(false);
    // catalog 잡의 결과 경로로 목록을 밀어넣지 못한다(반대도 마찬가지).
    expect(canAcceptModelResults({ ...job, jobType: "catalog" }, input)).toBe(false);
  });

  it("decodes percent-encoded Korean worker names from the claim header", () => {
    const request = (value: string | null) => ({ headers: { get: () => value } });
    // 워커는 한글 이름을 percent-인코딩해 보낸다 (HTTP 헤더 ByteString 제약)
    expect(getClaimWorkerId(request(encodeURIComponent("김재현")))).toBe("김재현");
    // 영문 이름은 인코딩 전후가 같다 — 구버전 워커의 비인코딩 전송도 통과
    expect(getClaimWorkerId(request("hong"))).toBe("hong");
    expect(getClaimWorkerId(request("%E0%A4%A"))).toBeNull(); // 깨진 인코딩
    expect(getClaimWorkerId(request(null))).toBeNull();
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
