import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { filterLatestPublicTrims } from "@/lib/vehicle-visibility-policy";

/**
 * 목록·상세가 PUBLIC_TRIM_WHERE 결과 전체를 대표가로 쓰면
 * 구형 연식 최저가가 카드에 남고 견적 페이지(최신 연식)와 어긋난다.
 * 견적 API 와 같은 filterLatestPublicTrims 를 적용한 뒤에 최저가를 고른다.
 */
describe("cars list representative trim contract", () => {
  it("does not pick an older-year trim as the card floor when a later year is public", () => {
    const queried = [
      {
        id: "old-cheap",
        price: 28_000_000,
        isVisible: true,
        lineup: { name: "2025년형 가솔린", isVisible: true },
      },
      {
        id: "latest-mid",
        price: 34_000_000,
        isVisible: true,
        lineup: { name: "2027년형 가솔린", isVisible: true },
      },
    ];

    const displayed = filterLatestPublicTrims(queried);
    const cardFloor = [...displayed].sort((a, b) => a.price - b.price)[0];

    expect(cardFloor?.id).toBe("latest-mid");
    expect(displayed.map((trim) => trim.id)).not.toContain("old-cheap");
  });

  it("wires the same latest-public filter into list and detail pages", () => {
    const listPage = readFileSync(
      resolve(process.cwd(), "src/app/(public)/cars/page.tsx"),
      "utf8",
    );
    const detailPage = readFileSync(
      resolve(process.cwd(), "src/app/(public)/cars/[slug]/page.tsx"),
      "utf8",
    );

    expect(listPage).toContain("filterLatestPublicTrims");
    expect(detailPage).toContain("filterLatestPublicTrims");
  });
});

describe("car detail ISR cache contract", () => {
  it("keeps on-demand params and a 10-minute revalidate window", () => {
    const detailPage = readFileSync(
      resolve(process.cwd(), "src/app/(public)/cars/[slug]/page.tsx"),
      "utf8",
    );

    expect(detailPage).toMatch(/export const revalidate = 600/);
    expect(detailPage).toMatch(/export const dynamicParams = true/);
    expect(detailPage).toContain("revalidatePath('/cars/[slug]', 'page')");
  });
});
