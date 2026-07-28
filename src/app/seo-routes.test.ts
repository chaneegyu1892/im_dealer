import { beforeEach, describe, expect, it, vi } from "vitest";

const { vehicleFindMany, reviewFindMany } = vi.hoisted(() => ({
  vehicleFindMany: vi.fn(),
  reviewFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findMany: vehicleFindMany },
    review: { findMany: reviewFindMany },
  },
}));

import robots from "./robots";
import sitemap from "./sitemap";

describe("search engine routes", () => {
  beforeEach(() => {
    vehicleFindMany.mockReset();
    reviewFindMany.mockReset();
    vehicleFindMany.mockResolvedValue([]);
    reviewFindMany.mockResolvedValue([]);
  });

  it("allows the public quote calculator while blocking private flows", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcardRule = rules.find((rule) => rule.userAgent === "*");
    const disallow = Array.isArray(wildcardRule?.disallow)
      ? wildcardRule.disallow
      : [wildcardRule?.disallow].filter(Boolean);

    expect(disallow).not.toContain("/quote");
    expect(disallow).toEqual(
      expect.arrayContaining([
        "/admin/",
        "/login",
        "/mypage",
        "/quote/delivery/",
        "/recommend/result",
        "/reviews/write/",
        "/verify",
      ]),
    );
    expect(result.sitemap).toBe("https://imdealer.co.kr/sitemap.xml");
  });

  it("publishes core pages plus visible vehicle and review URLs", async () => {
    vehicleFindMany.mockResolvedValue([
      {
        slug: "test-car",
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    reviewFindMany.mockResolvedValue([
      {
        id: "review-1",
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
      },
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://imdealer.co.kr/",
        "https://imdealer.co.kr/cars",
        "https://imdealer.co.kr/quote",
        "https://imdealer.co.kr/recommend",
        "https://imdealer.co.kr/reviews",
        "https://imdealer.co.kr/cars/test-car",
        "https://imdealer.co.kr/reviews/review-1",
      ]),
    );
    expect(urls).not.toEqual(
      expect.arrayContaining([
        "https://imdealer.co.kr/login",
        "https://imdealer.co.kr/mypage",
      ]),
    );
  });
});
