import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ supabaseAdmin: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: mocks.supabaseAdmin }));

import { uploadVehicleImageObject } from "./storage";

describe("vehicle image Supabase upload adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies a fetch-loss StorageUnknownError as object-may-exist", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("socket lost after send"));
    mocks.supabaseAdmin.mockReturnValue(createClient(
      "https://project.supabase.co",
      "service-role-test-key",
      { global: { fetch: fetchImpl } },
    ));

    const failure = uploadVehicleImageObject({
      path: "admin/vehicle-1/image.webp",
      file: new File(["image"], "image.webp", { type: "image/webp" }),
      contentType: "image/webp",
    });

    await expect(failure).rejects.toMatchObject({
      name: "VehicleImageStorageError",
      operation: "upload",
      objectMayExist: true,
    });
  });

  it("classifies an explicit 4xx StorageApiError as deterministic rejection", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "invalid upload" }),
      { status: 400, headers: { "content-type": "application/json" } },
    ));
    mocks.supabaseAdmin.mockReturnValue(createClient(
      "https://project.supabase.co",
      "service-role-test-key",
      { global: { fetch: fetchImpl } },
    ));

    const failure = uploadVehicleImageObject({
      path: "admin/vehicle-1/image.webp",
      file: new File(["image"], "image.webp", { type: "image/webp" }),
      contentType: "image/webp",
    });

    await expect(failure).rejects.toMatchObject({
      objectMayExist: false,
    });
  });
});
