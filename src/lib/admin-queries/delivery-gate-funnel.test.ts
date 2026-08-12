import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

import { getDeliveryGateFunnel } from "./delivery-gate-funnel";

describe("getDeliveryGateFunnel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps the aggregated bigint counts to funnel numbers", async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        calculated: BigInt(120),
        gate_shown: BigInt(30),
        login_clicked: BigInt(12),
        converted: BigInt(5),
      },
    ]);

    const funnel = await getDeliveryGateFunnel(new Date("2026-07-13"));

    expect(funnel).toEqual({
      calculated: 120,
      gateShown: 30,
      loginClicked: 12,
      converted: 5,
    });
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("returns zeros when the aggregation yields no row", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    const funnel = await getDeliveryGateFunnel(new Date("2026-07-13"));

    expect(funnel).toEqual({
      calculated: 0,
      gateShown: 0,
      loginClicked: 0,
      converted: 0,
    });
  });
});
