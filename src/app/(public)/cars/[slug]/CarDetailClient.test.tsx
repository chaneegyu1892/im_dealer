import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VehicleDetail } from "@/types/api";

vi.mock("@/components/cars/CarDetailBenefitsSection", () => ({ CarDetailBenefitsSection: () => null }));
vi.mock("@/components/cars/CarDetailImageSections", () => ({ CarDetailImageSections: () => null }));
vi.mock("@/components/cars/CarDetailRecommendBanner", () => ({ CarDetailRecommendBanner: () => null }));
vi.mock("@/components/cars/CarDetailRecommendationSection", () => ({ CarDetailRecommendationSection: () => null }));
vi.mock("@/components/cars/CarDetailQuoteSurfaces", () => ({
  CarDetailSidebar: () => null,
  MobileQuoteSummary: () => null,
}));
vi.mock("@/components/cars/CarDetailSpecsSection", () => ({ CarDetailSpecsSection: () => null }));
import { CarDetailClient } from "./CarDetailClient";

const vehicle = {
  id: "vehicle",
  slug: "test-car",
  name: "테스트 차량",
  brand: "테스트",
  category: "SUV",
  vehicleCode: null,
  basePrice: 40_000_000,
  evSubsidyRange: null,
  thumbnailUrl: "/representative.jpg",
  imageUrls: ["/hidden.jpg", "/deleted.jpg"],
  images: [],
  surchargeRate: 0,
  isPopular: false,
  description: null,
  trims: [],
  defaultTrim: null,
  scenarios: null,
  bestFinanceName: null,
  representativeQuotes: [],
  highlights: [],
  hasRateConfig: false,
  detailedSpecs: null,
  legacyImageFallbackAllowed: false,
  heroImageProjectionAllowed: false,
} satisfies VehicleDetail & { readonly heroImageProjectionAllowed: boolean };

function renderedClient(imageState: {
  readonly legacyImageFallbackAllowed: boolean;
  readonly heroImageProjectionAllowed: boolean;
}): string {
  return renderToStaticMarkup(
    <CarDetailClient vehicle={{ ...vehicle, ...imageState }} />,
  );
}

describe("CarDetailClient image fallback", () => {
  it("does not resurrect hidden or deleted managed primary URLs", () => {
    const markup = renderedClient({
      legacyImageFallbackAllowed: false,
      heroImageProjectionAllowed: false,
    });

    expect(markup).not.toContain("차량 이미지");
    expect(markup).not.toContain("representative.jpg");
    expect(markup).not.toContain("hidden.jpg");
    expect(markup).not.toContain("deleted.jpg");
  });

  it("retains raw legacy gallery URLs for an unmigrated vehicle", () => {
    const markup = renderedClient({
      legacyImageFallbackAllowed: true,
      heroImageProjectionAllowed: true,
    });

    expect(markup).toContain("차량 이미지");
    expect(markup).toContain("representative.jpg");
    expect(markup).toContain("hidden.jpg");
    expect(markup).toContain("deleted.jpg");
  });

  it("places the representative thumbnail as the first gallery slide", () => {
    // COVER(대표 썸네일)가 displayOrder 상 MAIN보다 뒤더라도 갤러리 첫 슬라이드에 온다.
    const markup = renderToStaticMarkup(
      <CarDetailClient
        vehicle={{
          ...vehicle,
          images: [
            { id: "main-1", type: "MAIN", title: null, storageUrl: "/main.jpg", displayOrder: 0 },
            { id: "cover-1", type: "COVER", title: null, storageUrl: "/representative.jpg", displayOrder: 1 },
          ],
          thumbnailUrl: "/representative.jpg",
          heroImageProjectionAllowed: true,
          legacyImageFallbackAllowed: false,
        }}
      />,
    );
    // 갤러리 슬라이드 순서: 썸네일(representative)이 먼저, MAIN이 그 다음.
    // next/image 최적화로 URL이 인코딩되므로 %2F(=/) 형태로 매칭한다.
    const firstIdx = markup.indexOf("%2Frepresentative.jpg");
    const mainIdx = markup.indexOf("%2Fmain.jpg");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(mainIdx).toBeGreaterThan(-1);
    expect(firstIdx).toBeLessThan(mainIdx);
  });
});
