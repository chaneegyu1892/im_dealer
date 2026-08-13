import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  findSheet: vi.fn(),
  updateManySheets: vi.fn(),
  updateSheet: vi.fn(),
  transaction: vi.fn(),
  requireRoleAtLeast: vi.fn(),
  logAdminAction: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    capitalRateSheet: {
      findUnique: mocks.findSheet,
      updateMany: mocks.updateManySheets,
      update: mocks.updateSheet,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));

vi.mock("@/lib/audit", () => ({
  logAdminAction: mocks.logAdminAction,
}));

vi.mock("@/lib/revalidate", () => ({
  revalidatePublicVehicleSurfaces: mocks.revalidate,
}));

function patchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://example.com/api/admin/capital-rates/sheet-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeParams = { params: Promise.resolve({ id: "sheet-1" }) };

describe("PATCH /api/admin/capital-rates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRoleAtLeast.mockResolvedValue({ admin: { id: "admin-1" }, error: null });
    mocks.findSheet.mockResolvedValue({
      id: "sheet-1",
      financeCompanyId: "finance-1",
      trimId: "trim-1",
      productType: "장기렌트",
      isActive: false,
    });
    mocks.transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations)
    );
    mocks.updateManySheets.mockResolvedValue({ count: 1 });
    mocks.updateSheet.mockResolvedValue({ id: "sheet-1", isActive: true });
    mocks.logAdminAction.mockResolvedValue(undefined);
  });

  it("only deactivates sibling sheets of the same product type when activating", async () => {
    const response = await PATCH(patchRequest({ setActive: true }), routeParams);

    expect(response.status).toBe(200);
    // 같은 트림의 리스 시트까지 꺼지면 해당 상품 견적 전체가 상담 전환된다.
    expect(mocks.updateManySheets).toHaveBeenCalledWith({
      where: {
        financeCompanyId: "finance-1",
        trimId: "trim-1",
        productType: "장기렌트",
        isActive: true,
      },
      data: { isActive: false },
    });
    expect(mocks.updateSheet).toHaveBeenCalledWith({
      where: { id: "sheet-1" },
      data: { isActive: true },
    });
  });
});
