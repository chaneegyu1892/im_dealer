import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  visibility: vi.fn(),
  trash: vi.fn(),
  restore: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({ requireRoleAtLeast: mocks.auth }));
vi.mock("@/lib/vehicle-images/item-mutations", () => ({
  setVehicleImageVisibility: mocks.visibility,
  trashVehicleImage: mocks.trash,
  restoreVehicleImage: mocks.restore,
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/revalidate", () => ({ revalidatePublicVehicleSurfaces: mocks.revalidate }));

import { PATCH as PATCH_VISIBILITY } from "./[imageId]/visibility/route";
import { DELETE } from "./[imageId]/route";
import { POST as POST_RESTORE } from "./[imageId]/restore/route";

const context = { params: Promise.resolve({ id: "vehicle-1", imageId: "image-1" }) };

function request(method: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images/image-1", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function malformedRequest(method: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images/image-1", {
    method,
    headers: { "content-type": "application/json" },
    body: "{\"expectedUpdatedAt\":",
  });
}

describe("vehicle image state routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ admin: { id: "staff-1", email: "staff@example.com" }, error: null });
    const outcome = {
      before: { id: "image-1" },
      image: { id: "image-1" },
      imageRevision: 1,
      vehicleUpdatedAt: new Date("2026-07-13T00:00:00.001Z"),
    };
    mocks.visibility.mockResolvedValue(outcome);
    mocks.trash.mockResolvedValue(outcome);
    mocks.restore.mockResolvedValue(outcome);
  });

  it("changes visibility through the strict visibility contract", async () => {
    const response = await PATCH_VISIBILITY(request("PATCH", {
      expectedUpdatedAt: "2026-07-12T12:00:00.000Z",
      expectedImageRevision: 0,
      isVisible: false,
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        image: expect.objectContaining({ id: "image-1" }),
        imageRevision: 1,
        vehicleUpdatedAt: "2026-07-13T00:00:00.001Z",
      },
    });
    expect(mocks.visibility).toHaveBeenCalledWith("vehicle-1", "image-1", expect.objectContaining({ isVisible: false }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_VISIBILITY" }));
  });

  it("soft deletes without invoking storage cleanup", async () => {
    const response = await DELETE(request("DELETE", { expectedUpdatedAt: "2026-07-12T12:00:00.000Z", expectedImageRevision: 0 }), context);
    expect(response.status).toBe(200);
    expect(mocks.trash).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_DELETE" }));
  });

  it("restores a trashed image without changing visibility at the route boundary", async () => {
    const response = await POST_RESTORE(request("POST", { expectedUpdatedAt: "2026-07-12T12:00:00.000Z", expectedImageRevision: 0 }), context);
    expect(response.status).toBe(200);
    expect(mocks.restore).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_RESTORE" }));
  });

  it("returns 400 for malformed visibility JSON", async () => {
    const response = await PATCH_VISIBILITY(malformedRequest("PATCH"), context);
    expect(response.status).toBe(400);
    expect(mocks.visibility).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed item DELETE JSON", async () => {
    const response = await DELETE(malformedRequest("DELETE"), context);
    expect(response.status).toBe(400);
    expect(mocks.trash).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed restore JSON", async () => {
    const response = await POST_RESTORE(malformedRequest("POST"), context);
    expect(response.status).toBe(400);
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});
