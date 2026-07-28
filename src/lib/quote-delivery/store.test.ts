import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabaseAdmin: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.supabaseAdmin }));

import { deleteQuoteImage, uploadQuoteImage } from "./store";

describe("quote delivery storage", () => {
  it("uses a bounded cache lifetime for public delivery PNGs", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.supabaseAdmin.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload: mocks.upload })) },
    });

    await uploadQuoteImage({ png: new Uint8Array([1, 2, 3]) });

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^deliveries\/[0-9a-f-]+\.png$/),
      expect.any(Uint8Array),
      {
        contentType: "image/png",
        cacheControl: "86400",
        upsert: false,
      }
    );
  });

  it("surfaces storage deletion failures to the lifecycle worker", async () => {
    mocks.remove.mockResolvedValue({ error: { message: "bucket unavailable" } });
    mocks.supabaseAdmin.mockReturnValue({
      storage: { from: vi.fn(() => ({ remove: mocks.remove })) },
    });

    await expect(deleteQuoteImage("deliveries/image.png")).rejects.toThrow(
      "QUOTE_STORAGE_DELETE_FAILED: bucket unavailable"
    );
  });
});
