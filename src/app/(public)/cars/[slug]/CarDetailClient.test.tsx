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
});
