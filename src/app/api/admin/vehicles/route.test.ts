import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: {
      findUnique: mocks.findUnique,
      create: mocks.create,
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

import { POST } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/vehicles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/vehicles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "vehicle-1", name: "쏘렌토" });
    mocks.audit.mockResolvedValue(undefined);
  });

  it("creates a vehicle when the non-image fields are valid", async () => {
    const response = await POST(
      request({
        name: "쏘렌토",
        brand: "기아",
        category: "SUV",
        basePrice: 40_000_000,
        description: "대표 SUV",
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "쏘렌토",
        brand: "기아",
        description: "대표 SUV",
      }),
    });
  });

  it("supplies server-owned empty legacy image defaults", async () => {
    const response = await POST(
      request({
        name: "쏘렌토",
        brand: "기아",
        category: "SUV",
        basePrice: 40_000_000,
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ thumbnailUrl: "", imageUrls: [] }),
    });
  });

  it("rejects client-owned legacy image fields", async () => {
    const response = await POST(
      request({
        name: "쏘렌토",
        brand: "기아",
        category: "SUV",
        basePrice: 40_000_000,
        thumbnailUrl: "https://untrusted/image.webp",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
