import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirstToken: vi.fn(),
  createToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewRequestToken: {
      findFirst: mocks.findFirstToken,
      create: mocks.createToken,
    },
  },
}));

import { issueOrReuseReviewToken } from "./review-token-issue";

describe("issueOrReuseReviewToken", () => {
  const TTL_MS = 30 * 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.imdealer.co.kr");
  });

  it("미사용·미회수·미만료 토큰이 있으면 재사용하고 create 를 호출하지 않는다", async () => {
    const expiresAt = new Date(Date.now() + TTL_MS);
    mocks.findFirstToken.mockResolvedValue({
      id: "token-row-1",
      token: "existing-token",
      expiresAt,
    });

    await expect(
      issueOrReuseReviewToken({ quoteId: "quote-1", createdById: "staff-1" }),
    ).resolves.toEqual({
      id: "token-row-1",
      token: "existing-token",
      url: "https://www.imdealer.co.kr/reviews/write/existing-token",
      expiresAt,
      reused: true,
    });
    expect(mocks.createToken).not.toHaveBeenCalled();
    expect(mocks.findFirstToken).toHaveBeenCalledWith({
      where: {
        savedQuoteId: "quote-1",
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("재사용할 토큰이 없으면 UUID 와 30일 TTL 로 발급한다", async () => {
    mocks.findFirstToken.mockResolvedValue(null);
    mocks.createToken.mockImplementation(async ({ data }) => ({
      id: "token-row-new",
      token: data.token,
      expiresAt: data.expiresAt,
    }));
    const before = Date.now();

    const issued = await issueOrReuseReviewToken({
      quoteId: "quote-1",
      createdById: "staff-1",
    });

    expect(issued.reused).toBe(false);
    expect(issued.id).toBe("token-row-new");
    expect(issued.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(issued.url).toBe(`https://www.imdealer.co.kr/reviews/write/${issued.token}`);
    expect(issued.expiresAt.getTime() - before).toBeGreaterThan(TTL_MS - 1000);
    expect(issued.expiresAt.getTime() - before).toBeLessThanOrEqual(TTL_MS + 1000);
    expect(mocks.createToken).toHaveBeenCalledWith({
      data: {
        token: issued.token,
        savedQuoteId: "quote-1",
        expiresAt: issued.expiresAt,
        createdById: "staff-1",
      },
    });
  });
});
