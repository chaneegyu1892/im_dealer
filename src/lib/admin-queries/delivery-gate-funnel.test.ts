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

  it("maps the aggregated bigint counts to member/guest funnel numbers", async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        member_calculated: BigInt(90),
        guest_calculated: BigInt(30),
        gate_shown: BigInt(18),
        login_clicked: BigInt(12),
        converted: BigInt(5),
      },
    ]);

    const funnel = await getDeliveryGateFunnel(new Date("2026-07-13"));

    expect(funnel).toEqual({
      memberCalculated: 90,
      guestCalculated: 30,
      gateShown: 18,
      loginClicked: 12,
      converted: 5,
    });
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });

  it("returns zeros when the aggregation yields no row", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    const funnel = await getDeliveryGateFunnel(new Date("2026-07-13"));

    expect(funnel).toEqual({
      memberCalculated: 0,
      guestCalculated: 0,
      gateShown: 0,
      loginClicked: 0,
      converted: 0,
    });
  });
});
