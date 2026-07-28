import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKER_PROTOCOL_VERSION } from "../../src/lib/scraper/worker-version";
import { claimJob } from "./api-client";

describe("scraper worker API client", () => {
  afterEach(() => vi.unstubAllGlobals());

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
    await claimJob();

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
    const result = await claimJob();

    // Then the worker loop can show the existing compatibility guidance
    expect(result).toEqual({
      job: null,
      credential: null,
      expectedWorkerVersion: WORKER_PROTOCOL_VERSION + 1,
    });
  });
});
