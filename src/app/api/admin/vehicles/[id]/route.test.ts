import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
  deleteWithCleanup: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: vi.fn(async () => ({
    admin: { id: "admin", email: "admin@example.com" },
    error: null,
  })),
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/revalidate", () => ({
  revalidatePublicVehicleSurfaces: mocks.revalidate,
}));
vi.mock("@/lib/vehicle-images/storage-cleanup", () => ({
  deleteVehicleWithStorageCleanup: mocks.deleteWithCleanup,
}));

import { DELETE, PATCH } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "vehicle-1" }) };

describe("PATCH /api/admin/vehicles/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ id: "vehicle-1", name: "기존 차량" });
    mocks.update.mockResolvedValue({ id: "vehicle-1", name: "수정 차량" });
    mocks.audit.mockResolvedValue(undefined);
    mocks.deleteWithCleanup.mockResolvedValue({
      vehicle: { id: "vehicle-1", name: "기존 차량" },
      cleanupJobs: 2,
    });
  });

  it("updates existing non-image vehicle fields", async () => {
    const response = await PATCH(
      request({ name: "수정 차량", isPopular: true }),
      context
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "vehicle-1" },
      data: { name: "수정 차량", isPopular: true },
    });
  });

  it.each([
    { thumbnailUrl: "https://untrusted/image.webp" },
    { imageUrls: ["https://untrusted/detail.webp"] },
    { name: "수정 차량", malformed: true },
  ])("rejects unknown or legacy image keys with 400: %o", async (body) => {
    const response = await PATCH(request(body), context);

    expect(response.status).toBe(400);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("deletes the vehicle and enqueues ADMIN storage cleanup atomically", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/admin/vehicles/vehicle-1", {
      method: "DELETE",
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.deleteWithCleanup).toHaveBeenCalledWith("vehicle-1");
    expect(await response.json()).toEqual({ success: true, storageCleanupJobs: 2 });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "VEHICLE_DELETE",
      before: expect.objectContaining({ id: "vehicle-1" }),
    }));
  });

  it("returns the typed 404 when the delete target is missing", async () => {
    const missing = Object.assign(new Error("VEHICLE_IMAGE_NOT_FOUND"), {
      status: 404,
      code: "VEHICLE_IMAGE_NOT_FOUND",
    });
    mocks.deleteWithCleanup.mockRejectedValue(missing);
    const response = await DELETE(new NextRequest("http://localhost/api/admin/vehicles/missing", {
      method: "DELETE",
    }), context);
    expect(response.status).toBe(404);
  });
});
