import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: { vehicle: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/representative-quote-query", () => ({
  getRepresentativeQuotesByVehicle: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/admin-queries", () => ({
  getPublicReviewsByVehicleId: vi.fn(async () => []),
  getBestReviews: vi.fn(async () => []),
}));
vi.mock("@/lib/car-json-ld", () => ({ buildCarJsonLd: () => [] }));
vi.mock("./CarDetailClient", () => ({
  CarDetailClient: ({ vehicle }: { readonly vehicle: unknown }) => (
    <script id="vehicle-payload" type="application/json">{JSON.stringify(vehicle)}</script>
  ),
}));

import CarDetailPage, { generateMetadata } from "./page";

function baseVehicle() {
  return {
    id: "vehicle",
    slug: "test-car",
    name: "테스트 차량",
    brand: "테스트",
    category: "SUV",
    vehicleCode: null,
    basePrice: 40_000_000,
    thumbnailUrl: "/thumbnail.jpg",
    thumbnailImageId: null,
    thumbnailImage: null,
    imageUrls: [],
    surchargeRate: 0,
    isVisible: true,
    isPopular: false,
    description: null,
    detailedSpecs: null,
    trims: [],
    recConfigs: null,
    images: [],
    _count: { images: 0 },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function renderedPayload(slug: string): Promise<Record<string, unknown>> {
  const markup = renderToStaticMarkup(await CarDetailPage({
    params: Promise.resolve({ slug }),
  }));
  const text = new DOMParser().parseFromString(markup, "text/html")
    .querySelector("#vehicle-payload")?.textContent ?? "{}";
  const payload: unknown = JSON.parse(text);
  if (!isRecord(payload)) {
    throw new TypeError("vehicle payload must be an object");
  }
  return payload;
}

describe("public car detail projection policy", () => {
  it("denies exact managed matches when every matching row is inactive", async () => {
    mocks.findUnique.mockResolvedValue({
      ...baseVehicle(),
      imageUrls: ["/legacy-gallery.jpg"],
      images: [{
        id: "hidden",
        type: "COVER",
        title: "숨김",
        sourceUrl: "/thumbnail.jpg",
        storageUrl: "/hidden.jpg",
        displayOrder: 0,
        isVisible: false,
        deletedAt: null,
      }],
      _count: { images: 1 },
    });

    expect(await renderedPayload("test-car")).toMatchObject({
      thumbnailUrl: "",
      imageUrls: [],
      images: [],
      legacyImageFallbackAllowed: false,
      heroImageProjectionAllowed: false,
    });
  });

  it("keeps legacy gallery fallback only for a truly unmigrated vehicle", async () => {
    mocks.findUnique.mockResolvedValue({
      ...baseVehicle(),
      imageUrls: ["/legacy-gallery.jpg"],
    });

    expect(await renderedPayload("test-car")).toMatchObject({
      thumbnailUrl: "/thumbnail.jpg",
      imageUrls: ["/legacy-gallery.jpg"],
      legacyImageFallbackAllowed: true,
      heroImageProjectionAllowed: true,
    });
  });

  it("allows only an active same-vehicle linked projection", async () => {
    mocks.findUnique.mockResolvedValue({
      ...baseVehicle(),
      thumbnailImageId: "linked-image",
      thumbnailImage: {
        vehicleId: "vehicle",
        isVisible: true,
        deletedAt: null,
        storageUrl: "/thumbnail.jpg",
      },
      _count: { images: 1 },
    });

    expect(await renderedPayload("test-car")).toMatchObject({
      thumbnailUrl: "/thumbnail.jpg",
      heroImageProjectionAllowed: true,
    });
  });

  it("omits inactive exact managed matches from social metadata", async () => {
    mocks.findUnique.mockResolvedValue({
      ...baseVehicle(),
      images: [{
        type: "COVER",
        sourceUrl: "/thumbnail.jpg",
        storageUrl: "/stale-mirror.jpg",
        isVisible: false,
        deletedAt: null,
      }],
      _count: { images: 1 },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "test-car" }),
    });

    expect(metadata.openGraph?.images).toBeUndefined();
    expect(metadata.twitter?.images).toBeUndefined();
  });
});
