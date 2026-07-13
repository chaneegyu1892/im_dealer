import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  edit: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({ requireRoleAtLeast: mocks.auth }));
vi.mock("@/lib/vehicle-images/item-mutations", () => ({
  listVehicleImages: mocks.list,
  editVehicleImage: mocks.edit,
}));
vi.mock("@/lib/vehicle-images/upload", () => ({ uploadVehicleImage: mocks.upload }));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/revalidate", () => ({ revalidatePublicVehicleSurfaces: mocks.revalidate }));

import { GET, POST } from "./route";
import { PATCH } from "./[imageId]/route";

const context = { params: Promise.resolve({ id: "vehicle-1" }) };
const itemContext = { params: Promise.resolve({ id: "vehicle-1", imageId: "image-1" }) };

function jsonRequest(method: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images/image-1", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function malformedJsonRequest(method: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images/image-1", {
    method,
    headers: { "content-type": "application/json" },
    body: "{\"expectedUpdatedAt\":",
  });
}

describe("vehicle image create and update routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ admin: { id: "staff-1", email: "staff@example.com" }, error: null });
    mocks.list.mockResolvedValue({
      thumbnailImageId: null,
      thumbnailUrl: "https://legacy.example/representative.webp",
      imageRevision: 0,
      images: [{ id: "image-1", origin: "ADMIN", isRepresentative: false }],
      vehicleUpdatedAt: "2026-07-13T00:00:00.000Z",
    });
    mocks.upload.mockResolvedValue({
      image: { id: "image-1", origin: "ADMIN" },
      imageRevision: 1,
      vehicleUpdatedAt: new Date("2026-07-13T00:00:00.001Z"),
    });
    mocks.edit.mockResolvedValue({
      before: { title: "old" },
      image: { id: "image-1", title: "new" },
      imageRevision: 2,
      vehicleUpdatedAt: new Date("2026-07-13T00:00:00.002Z"),
    });
  });

  it("lists images when a staff actor is authenticated", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images"), context);
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith("vehicle-1");
    expect(await response.json()).toEqual({
      success: true,
      data: {
        thumbnailImageId: null,
        thumbnailUrl: "https://legacy.example/representative.webp",
        imageRevision: 0,
        images: [{ id: "image-1", origin: "ADMIN", isRepresentative: false }],
        vehicleUpdatedAt: "2026-07-13T00:00:00.000Z",
      },
    });
  });

  it("rejects dealer access before delegating", async () => {
    mocks.auth.mockResolvedValue({ admin: null, error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) });
    const response = await GET(new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images"), context);
    expect(response.status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("rejects malformed multipart and client-owned storage fields", async () => {
    const form = new FormData();
    form.set("title", "커버");
    form.set("type", "COVER");
    form.set("isVisible", "true");
    form.set("origin", "ADMIN");
    const response = await POST(new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images", { method: "POST", body: form }), context);
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns 400 for a genuinely truncated multipart body", async () => {
    const request = new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=broken" },
      body: "--broken\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\npartial",
    });
    const response = await POST(request, context);
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads a strict multipart image and records the create audit action", async () => {
    const form = new FormData();
    form.set("file", new File(["image"], "cover.webp", { type: "image/webp" }));
    form.set("title", "커버");
    form.set("type", "COVER");
    form.set("isVisible", "true");
    const response = await POST(new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images", { method: "POST", body: form }), context);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        image: expect.objectContaining({ id: "image-1", origin: "ADMIN" }),
        imageRevision: 1,
        vehicleUpdatedAt: "2026-07-13T00:00:00.001Z",
      },
    });
    expect(mocks.upload).toHaveBeenCalledWith("vehicle-1", expect.objectContaining({ title: "커버", type: "COVER" }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_CREATE" }));
  });

  it("maps a rejected upload file contract to typed 400", async () => {
    mocks.upload.mockRejectedValue(Object.assign(new Error("UNSUPPORTED_MIME"), {
      status: 400,
      code: "UNSUPPORTED_MIME",
    }));
    const form = new FormData();
    form.set("file", new File(["text"], "bad.txt", { type: "text/plain" }));
    form.set("title", "잘못된 파일");
    form.set("type", "MAIN");
    form.set("isVisible", "true");
    const response = await POST(new NextRequest("http://localhost/api/admin/vehicles/vehicle-1/images", { method: "POST", body: form }), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "UNSUPPORTED_MIME", code: "UNSUPPORTED_MIME" });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("delegates a strict optimistic edit and audits the update", async () => {
    const response = await PATCH(jsonRequest("PATCH", {
      expectedUpdatedAt: "2026-07-12T12:00:00.000Z",
      expectedImageRevision: 0,
      title: "new",
    }), itemContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        image: expect.objectContaining({ id: "image-1", title: "new" }),
        imageRevision: 2,
        vehicleUpdatedAt: "2026-07-13T00:00:00.002Z",
      },
    });
    expect(mocks.edit).toHaveBeenCalledWith("vehicle-1", "image-1", expect.objectContaining({ title: "new" }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "VEHICLE_IMAGE_UPDATE" }));
    expect(mocks.revalidate).toHaveBeenCalledOnce();
  });

  it("maps a stale optimistic edit to typed 409 without audit", async () => {
    mocks.edit.mockRejectedValue(Object.assign(new Error("STALE_IMAGE_STATE"), {
      status: 409,
      code: "STALE_IMAGE_STATE",
    }));
    const response = await PATCH(jsonRequest("PATCH", {
      expectedUpdatedAt: "2026-07-12T12:00:00.000Z",
      expectedImageRevision: 0,
      title: "new",
    }), itemContext);
    expect(response.status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed item PATCH JSON before delegation", async () => {
    const response = await PATCH(malformedJsonRequest("PATCH"), itemContext);
    expect(response.status).toBe(400);
    expect(mocks.edit).not.toHaveBeenCalled();
  });

  it("keeps unexpected item service errors as 500", async () => {
    mocks.edit.mockRejectedValue(new Error("database unavailable"));
    const response = await PATCH(jsonRequest("PATCH", {
      expectedUpdatedAt: "2026-07-12T12:00:00.000Z",
      expectedImageRevision: 0,
      title: "new",
    }), itemContext);
    expect(response.status).toBe(500);
  });
});
