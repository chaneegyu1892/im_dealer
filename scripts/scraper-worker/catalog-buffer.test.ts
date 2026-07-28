import { describe, expect, it, vi } from "vitest";
import { createCatalogResultBuffer } from "./catalog-buffer";

describe("createCatalogResultBuffer", () => {
  it("retains a failed final batch and rejects instead of reporting completion", async () => {
    const post = vi.fn().mockRejectedValue(new Error("storage unavailable"));
    const buffer = createCatalogResultBuffer(post);
    buffer.add({ mdelCd: "trim-1" });

    await expect(buffer.flush({ required: true })).rejects.toThrow("storage unavailable");
    expect(buffer.size()).toBe(1);
  });

  it("allows an intermediate flush to retry later without losing entries", async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(undefined);
    const buffer = createCatalogResultBuffer(post);
    buffer.add({ mdelCd: "trim-1" });

    await expect(buffer.flush({ required: false })).resolves.toBe(false);
    expect(buffer.size()).toBe(1);
    await expect(buffer.flush({ required: true })).resolves.toBe(true);
    expect(buffer.size()).toBe(0);
  });
});
