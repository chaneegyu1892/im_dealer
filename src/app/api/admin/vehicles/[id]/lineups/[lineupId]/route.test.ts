import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  lineupUpdate: vi.fn(),
  trimUpdateMany: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicleLineup: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
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

import { PATCH } from "./route";

const context = {
  params: Promise.resolve({ id: "vehicle-1", lineupId: "lineup-1" }),
};

function request(isVisible: boolean): NextRequest {
  return new NextRequest(
    "http://localhost/api/admin/vehicles/vehicle-1/lineups/lineup-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isVisible }),
    },
  );
}

function importedTrim(id: string, state: string, isVisible: boolean) {
  return {
    id,
    externalId: `external-${id}`,
    isVisible,
    detailedSpecs: { externalRaw: { state } },
  };
}

describe("PATCH /api/admin/vehicles/[id]/lineups/[lineupId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lineupUpdate.mockResolvedValue({
      id: "lineup-1",
      vehicleId: "vehicle-1",
      name: "2027년형 롱레인지",
      isVisible: true,
    });
    mocks.trimUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (mutation) => mutation({
      trim: { updateMany: mocks.trimUpdateMany },
      vehicleLineup: { update: mocks.lineupUpdate },
    }));
    mocks.audit.mockResolvedValue(undefined);
  });

  it("라인업 노출 시 판매 중 트림만 복구하고 판매 종료 트림은 숨긴다", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "lineup-1",
      vehicleId: "vehicle-1",
      name: "2027년형 롱레인지",
      isVisible: false,
      trims: [
        importedTrim("sold", "2", false),
        importedTrim("ended", "3", true),
      ],
    });

    const response = await PATCH(request(true), context);

    expect(response.status).toBe(200);
    expect(mocks.trimUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ["sold"] },
        lineupId: "lineup-1",
        vehicleId: "vehicle-1",
      },
      data: { isVisible: true },
    });
    expect(mocks.trimUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ["ended"] },
        lineupId: "lineup-1",
        vehicleId: "vehicle-1",
      },
      data: { isVisible: false },
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      meta: { trimsShown: 1, trimsHidden: 1, preservedVisibleTrims: 0 },
    }));
  });

  it("라인업 비노출 시 트림 판매 상태는 덮어쓰지 않는다", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "lineup-1",
      vehicleId: "vehicle-1",
      name: "2027년형 롱레인지",
      isVisible: true,
      trims: [importedTrim("sold", "2", true)],
    });
    mocks.lineupUpdate.mockResolvedValue({
      id: "lineup-1",
      vehicleId: "vehicle-1",
      name: "2027년형 롱레인지",
      isVisible: false,
    });

    const response = await PATCH(request(false), context);

    expect(response.status).toBe(200);
    expect(mocks.trimUpdateMany).not.toHaveBeenCalled();
    expect(mocks.lineupUpdate).toHaveBeenCalledWith({
      where: { id: "lineup-1" },
      data: { isVisible: false },
    });
  });

  it("판매 가능한 트림이 없으면 라인업 노출을 차단한다", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "lineup-1",
      vehicleId: "vehicle-1",
      name: "2027년형 롱레인지",
      isVisible: false,
      trims: [importedTrim("ended", "3", false)],
    });

    const response = await PATCH(request(true), context);

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
