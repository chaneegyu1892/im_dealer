import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("../prisma", () => ({
  prisma: {
    customerVerification: {
      findMany: mocks.findMany,
    },
  },
}));

import { getRecentVerifications } from "./verifications";

describe("getRecentVerifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("selects metadata only and never reads provider or encrypted PII columns", async () => {
    await getRecentVerifications(25);

    expect(mocks.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        sessionId: true,
        customerType: true,
        licenseVerified: true,
        insuranceVerified: true,
        bizVerified: true,
        consentedAt: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

    const query = mocks.findMany.mock.calls[0]?.[0];
    for (const forbidden of [
      "connectedId",
      "licenseData",
      "insuranceData",
      "bizData",
      "userId",
      "piiPurgedAt",
      "documents",
    ]) {
      expect(query.select).not.toHaveProperty(forbidden);
    }
  });
});
