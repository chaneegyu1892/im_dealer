import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), purge: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }));

vi.mock("@/lib/require-admin", () => ({ requireRoleAtLeast: mocks.auth }));
vi.mock("@/lib/vehicle-images/storage-cleanup", () => ({ purgeVehicleImage: mocks.purge }));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/revalidate", () => ({ revalidatePublicVehicleSurfaces: mocks.revalidate }));

import { DELETE } from "./[imageId]/purge/route";

const context = { params: Promise.resolve({ id: "vehicle-1", imageId: "image-1" }) };

function request(): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images/image-1/purge", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedUpdatedAt: "2026-07-12T12:00:00.000Z", expectedImageRevision: 0 }),
  });
}

function malformedRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images/image-1/purge", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: "{\"expectedUpdatedAt\":",
  });
}

describe("vehicle image permanent cleanup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ admin: { id: "admin-1", email: "admin@example.com" }, error: null });
    mocks.purge.mockResolvedValue({
      before: { id: "image-1" },
      storageCleanup: "deferred",
      imageRevision: 1,
      vehicleUpdatedAt: new Date("2026-07-13T00:00:00.001Z"),
    });
  });

  it("requires admin instead of staff authorization", async () => {
    mocks.auth.mockResolvedValue({ admin: null, error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) });
    const response = await DELETE(request(), context);
    expect(response.status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith("admin");
    expect(mocks.purge).not.toHaveBeenCalled();
  });

  it("keeps failed cleanup queryable and reports deferred", async () => {
    const response = await DELETE(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        storageCleanup: "deferred",
        imageRevision: 1,
        vehicleUpdatedAt: "2026-07-13T00:00:00.001Z",
      },
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_PURGE" }));
  });

  it("audits legacy ADMIN row purge without a storage cleanup job", async () => {
    mocks.purge.mockResolvedValue({
      before: { id: "image-1", origin: "ADMIN", adminStoragePath: null },
      storageCleanup: "deleted",
      imageRevision: 2,
      vehicleUpdatedAt: new Date("2026-07-13T00:00:00.002Z"),
    });
    const response = await DELETE(request(), context);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        storageCleanup: "deleted",
        imageRevision: 2,
        vehicleUpdatedAt: "2026-07-13T00:00:00.002Z",
      },
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "VEHICLE_IMAGE_PURGE",
      before: expect.objectContaining({ origin: "ADMIN" }),
    }));
  });

  it("returns 409 and skips audit when CARPAN2 purge is forbidden", async () => {
    mocks.purge.mockRejectedValue(Object.assign(new Error("CARPAN2_IMAGE_PURGE_FORBIDDEN"), {
      status: 409,
      code: "CARPAN2_IMAGE_PURGE_FORBIDDEN",
    }));
    const response = await DELETE(request(), context);
    expect(response.status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed purge JSON", async () => {
    const response = await DELETE(malformedRequest(), context);
    expect(response.status).toBe(400);
    expect(mocks.purge).not.toHaveBeenCalled();
  });
});
