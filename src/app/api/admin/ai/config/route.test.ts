import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { compileOverlapCatalog } from "@/lib/recommend/overlap-catalog";
import { EXCLUDED_RECOMMENDATION_VEHICLES } from "@/lib/recommend/excluded-vehicles";

const mocks = vi.hoisted(() => ({
  vehicleFindUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: mocks.vehicleFindUnique },
    recommendationConfig: {
      create: mocks.create,
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
  },
}));
vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: vi.fn(async () => ({ admin: { id: "admin", email: "admin@example.com" }, error: null })),
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/revalidate", () => ({ revalidatePublicVehicleSurfaces: mocks.revalidate }));

import { POST } from "./route";

const profile = compileOverlapCatalog()[0]?.profile;
const updatedAt = new Date("2026-07-12T00:00:00.000Z");
const existing = {
  id: "config-1",
  vehicleId: "vehicle-1",
  scoreMatrix: profile,
  highlights: ["기존"],
  aiCaption: "기존 캡션",
  isActive: true,
  updatedAt,
  updatedBy: "old",
};

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/ai/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function vehicle(recConfigs: unknown = null) {
  return { id: "vehicle-1", slug: "safe-slug", name: "안전 차량", category: "SUV", recConfigs };
}

describe("POST /api/admin/ai/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.vehicleFindUnique.mockResolvedValue(vehicle());
    mocks.create.mockResolvedValue({ ...existing, highlights: [], aiCaption: null });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue(existing);
    mocks.audit.mockResolvedValue(undefined);
  });

  it("creates a missing profile with safe metadata defaults and before null", async () => {
    expect(profile).toBeDefined();
    const response = await POST(request({ action: "create", vehicleId: "vehicle-1", profile, isActive: true }));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ highlights: [], aiCaption: null, scoreMatrix: profile }) });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ before: null, after: expect.objectContaining({ vehicleId: "vehicle-1" }) }));
  });

  it("updates with optimistic locking, preserves omitted highlights, and clears caption explicitly", async () => {
    mocks.vehicleFindUnique.mockResolvedValue(vehicle(existing));
    mocks.findUniqueOrThrow.mockResolvedValue({ ...existing, aiCaption: null });
    const response = await POST(request({
      action: "update",
      vehicleId: "vehicle-1",
      expectedUpdatedAt: updatedAt.toISOString(),
      profile,
      isActive: true,
      aiCaption: null,
    }));
    expect(response.status).toBe(200);
    const data = mocks.updateMany.mock.calls[0]?.[0].data;
    expect(data.aiCaption).toBeNull();
    expect(data).not.toHaveProperty("highlights");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ before: expect.objectContaining({ aiCaption: "기존 캡션" }) }));
  });

  it("deactivates an invalid legacy row without parsing its profile", async () => {
    const legacy = { ...existing, scoreMatrix: { industry: { 법인: 9 } } };
    mocks.vehicleFindUnique.mockResolvedValue(vehicle(legacy));
    mocks.findUniqueOrThrow.mockResolvedValue({ ...legacy, isActive: false });
    const response = await POST(request({ action: "deactivate", vehicleId: "vehicle-1", expectedUpdatedAt: updatedAt.toISOString() }));
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
  });

  it("returns 409 and performs no audit when the optimistic lock is stale", async () => {
    mocks.vehicleFindUnique.mockResolvedValue(vehicle(existing));
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const response = await POST(request({
      action: "update",
      vehicleId: "vehicle-1",
      expectedUpdatedAt: updatedAt.toISOString(),
      profile,
      isActive: true,
    }));
    expect(response.status).toBe(409);
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects missing update versions and nonexistent vehicles", async () => {
    const invalid = await POST(request({ action: "update", vehicleId: "vehicle-1", profile, isActive: true }));
    expect(invalid.status).toBe(400);
    mocks.vehicleFindUnique.mockResolvedValue(null);
    const missing = await POST(request({ action: "create", vehicleId: "missing", profile, isActive: true }));
    expect(missing.status).toBe(404);
  });

  it("forbids activation/save for every one of the 15 exclusions", async () => {
    expect(EXCLUDED_RECOMMENDATION_VEHICLES).toHaveLength(15);
    for (const excluded of EXCLUDED_RECOMMENDATION_VEHICLES) {
      mocks.vehicleFindUnique.mockResolvedValue({ id: "vehicle-1", slug: excluded.slug, name: excluded.documentName, category: "SUV", recConfigs: null });
      const response = await POST(request({ action: "create", vehicleId: "vehicle-1", profile, isActive: true }));
      expect(response.status, excluded.slug).toBe(400);
    }
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
