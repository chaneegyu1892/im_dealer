import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKER_PROTOCOL_VERSION } from "../../src/lib/scraper/worker-version";
import { SCRAPE_JOB_LEASE_TOKEN_HEADER } from "../../src/lib/scraper/job-state";
import { createApiClient, parseApiBases } from "./api-client";

describe("parseApiBases", () => {
  it("splits a comma list, trimming whitespace and trailing slashes and dropping empties/duplicates", () => {
    // Given the WORKER_API_BASE value an operator might paste for two servers
    const raw = " https://imdealer.co.kr/ , https://imdealer-tester.vercel.app ,, https://imdealer.co.kr ";

    // When the worker parses its target list
    const bases = parseApiBases(raw);

    // Then each server appears exactly once, normalized
    expect(bases).toEqual(["https://imdealer.co.kr", "https://imdealer-tester.vercel.app"]);
  });

  it("returns an empty list when the variable is missing", () => {
    expect(parseApiBases(undefined)).toEqual([]);
    expect(parseApiBases("")).toEqual([]);
  });
});

describe("scraper worker API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  const api = createApiClient("https://example.test");

  it("sends its protocol version when claiming a job", async () => {
    // Given a backend accepting an empty claim response
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ job: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    // When the worker claims a job
    await api.claimJob();

    // Then the request identifies the worker protocol before a claim can occur
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/worker/scrape-jobs/claim"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-worker-protocol-version": String(WORKER_PROTOCOL_VERSION),
        }),
      })
    );
  });

  it("targets the base URL its client was created for", async () => {
    // Given two clients pointed at different servers
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ job: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const prod = createApiClient("https://prod.example");
    const tester = createApiClient("https://tester.example/");

    // When each client claims a job
    await prod.claimJob();
    await tester.claimJob();

    // Then requests go to each client's own server (trailing slash normalized)
    expect(fetchMock.mock.calls[0][0]).toBe("https://prod.example/api/worker/scrape-jobs/claim");
    expect(fetchMock.mock.calls[1][0]).toBe("https://tester.example/api/worker/scrape-jobs/claim");
  });

  it("preserves the expected version from a protocol incompatibility response", async () => {
    // Given a backend that requires a newer worker protocol
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "worker_protocol_version_incompatible",
            expectedWorkerVersion: WORKER_PROTOCOL_VERSION + 1,
            receivedWorkerVersion: String(WORKER_PROTOCOL_VERSION),
          }),
          { status: 409, headers: { "content-type": "application/json" } }
        )
      )
    );

    // When the worker attempts to claim a job
    const result = await api.claimJob();

    // Then the worker loop can show the existing compatibility guidance
    expect(result).toEqual({
      job: null,
      credential: null,
      expectedWorkerVersion: WORKER_PROTOCOL_VERSION + 1,
    });
  });

  it("sends the claimed lease token on every job mutation without duplicating it in payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "running" }), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const leaseToken = "25db3703-3c79-4b91-a138-b95cf86b4151";

    await api.heartbeat("job-1", leaseToken);
    await api.postResult("job-1", leaseToken, { ok: false, error: "failed" });
    await api.postCatalogResults({
      jobId: "job-1",
      leaseToken,
      financeCompanyId: "fc-1",
      productType: "장기렌트",
      weekOf: "2026-07-20",
      entries: [{
        brandCd: "B-1",
        brandName: "브랜드",
        modelCd: "M-1",
        modelName: "모델",
        dtMdlCd: "D-1",
        mdelCd: "T-1",
        trimName: "트림",
        vehiclePrice: 40_000_000,
        baseRates: {},
        warnings: [],
      }],
    });

    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers).toMatchObject({ [SCRAPE_JOB_LEASE_TOKEN_HEADER]: leaseToken });
    }
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).not.toHaveProperty("leaseToken");
  });
});
