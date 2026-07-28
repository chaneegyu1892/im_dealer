import { describe, expect, it } from "vitest";
import {
  CANONICAL_SITE_URL,
  createPageMetadata,
  normalizeSiteUrl,
  summarizeMetaDescription,
} from "./site-config";

describe("normalizeSiteUrl", () => {
  it("uses the production canonical URL when configuration is missing or invalid", () => {
    expect(normalizeSiteUrl()).toBe(CANONICAL_SITE_URL);
    expect(normalizeSiteUrl("not-a-url")).toBe(CANONICAL_SITE_URL);
  });

  it("normalizes the service http/www variants to the https apex URL", () => {
    expect(normalizeSiteUrl("http://www.imdealer.co.kr/")).toBe(
      CANONICAL_SITE_URL,
    );
    expect(normalizeSiteUrl("https://imdealer.co.kr/path")).toBe(
      CANONICAL_SITE_URL,
    );
  });

  it("keeps the origin for an explicitly configured non-production host", () => {
    expect(normalizeSiteUrl("https://imdealer-preview.example/path?q=1")).toBe(
      "https://imdealer-preview.example",
    );
  });
});

describe("createPageMetadata", () => {
  it("creates an absolute canonical URL and a single branded page title", () => {
    const metadata = createPageMetadata({
      title: "차량 탐색",
      description: "차량을 비교합니다.",
      path: "/cars",
    });

    expect(metadata.title).toBe("차량 탐색");
    expect(metadata.alternates?.canonical).toBe(
      `${CANONICAL_SITE_URL}/cars`,
    );
    expect(metadata.openGraph?.title).toBe("차량 탐색 | 아임딜러");
  });
});

describe("summarizeMetaDescription", () => {
  it("normalizes whitespace and limits the description length", () => {
    expect(summarizeMetaDescription("  차량을   비교합니다.  ")).toBe(
      "차량을 비교합니다.",
    );
    expect(summarizeMetaDescription("가".repeat(100))).toHaveLength(80);
    expect(summarizeMetaDescription("가".repeat(100))).toMatch(/…$/);
  });
});
