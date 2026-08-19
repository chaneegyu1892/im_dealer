import { describe, expect, it } from "vitest";
import { buildCarJsonLd } from "./car-json-ld";

const base = {
  siteUrl: "https://imdealer.co.kr",
  slug: "tucson",
  name: "투싼",
  brand: "현대",
  category: "SUV",
  description: null,
  thumbnailUrl: null,
  trims: [{ price: 30_000_000 }],
  basePrice: 30_000_000,
};

describe("buildCarJsonLd availability", () => {
  it("재고가 있으면 InStock, 없으면 OutOfStock 을 쓴다", () => {
    const inStock = buildCarJsonLd({ ...base, hasAvailableInventory: true });
    const outOfStock = buildCarJsonLd({ ...base, hasAvailableInventory: false });

    expect(inStock[0]).toMatchObject({
      offers: { availability: "https://schema.org/InStock" },
    });
    expect(outOfStock[0]).toMatchObject({
      offers: { availability: "https://schema.org/OutOfStock" },
    });
  });
});
