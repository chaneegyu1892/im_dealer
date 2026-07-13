import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), reorder: vi.fn(), representative: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }));

vi.mock("@/lib/require-admin", () => ({ requireRoleAtLeast: mocks.auth }));
vi.mock("@/lib/vehicle-images/ordering", () => ({ reorderVehicleImages: mocks.reorder }));
vi.mock("@/lib/vehicle-images/representative", () => ({ setVehicleRepresentative: mocks.representative }));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/revalidate", () => ({ revalidatePublicVehicleSurfaces: mocks.revalidate }));

import { PATCH as PATCH_REORDER } from "./reorder/route";
import { POST as POST_REPRESENTATIVE } from "./[imageId]/set-representative/route";

const vehicleContext = { params: Promise.resolve({ id: "vehicle-1" }) };
const imageContext = { params: Promise.resolve({ id: "vehicle-1", imageId: "image-1" }) };

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function malformedRequest(method: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images", {
    method,
    headers: { "content-type": "application/json" },
    body: "{\"items\":",
  });
}

describe("vehicle image ordering and representative routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ admin: { id: "staff-1", email: "staff@example.com" }, error: null });
    mocks.reorder.mockResolvedValue({
      before: [],
      images: [{ id: "image-1", displayOrder: 0 }],
      imageRevision: 1,
      vehicleUpdatedAt: new Date("2026-07-13T00:00:00.001Z"),
    });
    mocks.representative.mockResolvedValue({
      before: null,
      vehicle: {
        id: "vehicle-1",
        thumbnailImageId: "image-1",
        thumbnailUrl: "/image.webp",
        imageRevision: 2,
        updatedAt: new Date("2026-07-13T00:00:00.002Z"),
      },
    });
  });

  it("rejects duplicate reorder IDs before delegation", async () => {
    const response = await PATCH_REORDER(request({
      group: "PRIMARY",
      expectedImageRevision: 0,
      items: [
        { id: "image-1", expectedUpdatedAt: "2026-07-12T12:00:00.000Z" },
        { id: "image-1", expectedUpdatedAt: "2026-07-12T12:00:00.000Z" },
      ],
    }), vehicleContext);
    expect(response.status).toBe(400);
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("delegates a complete group reorder and audits once", async () => {
    const response = await PATCH_REORDER(request({
      group: "PRIMARY",
      expectedImageRevision: 0,
      items: [{ id: "image-1", expectedUpdatedAt: "2026-07-12T12:00:00.000Z" }],
    }), vehicleContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        images: [expect.objectContaining({ id: "image-1", displayOrder: 0 })],
        imageRevision: 1,
        vehicleUpdatedAt: "2026-07-13T00:00:00.001Z",
      },
    });
    expect(mocks.reorder).toHaveBeenCalledOnce();
    expect(mocks.reorder).toHaveBeenCalledWith("vehicle-1", expect.objectContaining({ expectedImageRevision: 0 }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_REORDER" }));
  });

  it("sets representative using both optimistic versions", async () => {
    const response = await POST_REPRESENTATIVE(request({
      expectedImageUpdatedAt: "2026-07-12T12:00:00.000Z",
      expectedImageRevision: 1,
      expectedVehicleUpdatedAt: "2026-07-12T12:00:00.000Z",
    }), imageContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        thumbnailImageId: "image-1",
        thumbnailUrl: "/image.webp",
        imageRevision: 2,
        vehicleUpdatedAt: "2026-07-13T00:00:00.002Z",
      },
    });
    expect(mocks.representative).toHaveBeenCalledWith("vehicle-1", "image-1", expect.objectContaining({ expectedImageRevision: 1, expectedVehicleUpdatedAt: expect.any(String) }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_SET_REPRESENTATIVE" }));
  });

  it("returns 400 for malformed reorder JSON", async () => {
    const response = await PATCH_REORDER(malformedRequest("PATCH"), vehicleContext);
    expect(response.status).toBe(400);
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed representative JSON", async () => {
    const response = await POST_REPRESENTATIVE(malformedRequest("POST"), imageContext);
    expect(response.status).toBe(400);
    expect(mocks.representative).not.toHaveBeenCalled();
  });
});
