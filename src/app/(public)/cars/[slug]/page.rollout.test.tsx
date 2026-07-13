import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  buildJsonLd: vi.fn(() => []),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { vehicle: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/representative-quote-query", () => ({
  getRepresentativeQuotesByVehicle: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/admin-queries", () => ({
  getPublicReviewsByVehicleId: vi.fn(async () => []),
  getBestReviews: vi.fn(async () => []),
}));
vi.mock("@/lib/car-json-ld", () => ({ buildCarJsonLd: mocks.buildJsonLd }));
vi.mock("./CarDetailClient", () => ({
  CarDetailClient: ({ vehicle }: { readonly vehicle: unknown }) => (
    <script id="vehicle-payload" type="application/json">{JSON.stringify(vehicle)}</script>
  ),
}));

import CarDetailPage, { generateMetadata } from "./page";

const sourceUrl = "https://source.example/407-cover.webp";
const managedImage = {
  id: "image-cover",
  type: "COVER",
  title: "표지",
  sourceUrl,
  storageUrl: "https://cdn.example/407-cover.webp",
  displayOrder: 0,
  isVisible: true,
  deletedAt: null,
} as const;

function vehicle() {
  return {
    id: "vehicle-rollout",
    slug: "rollout-car",
    name: "롤아웃 차량",
    brand: "테스트",
    category: "SUV",
    vehicleCode: null,
    basePrice: 40_000_000,
    thumbnailUrl: sourceUrl,
    thumbnailImageId: null,
    thumbnailImage: null,
    imageUrls: ["/legacy-gallery.webp"],
    surchargeRate: 0,
    isVisible: true,
    isPopular: false,
    description: null,
    detailedSpecs: null,
    trims: [],
    recConfigs: null,
    images: [managedImage],
    _count: { images: 1 },
  };
}

describe("public car detail rollout thumbnail projection", () => {
  it("keeps an active unlinked managed source URL in OpenGraph and Twitter metadata", async () => {
    mocks.findUnique.mockResolvedValue(vehicle());

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "rollout-car" }),
    });

    expect(metadata.openGraph?.images).toEqual([{ url: sourceUrl, alt: "테스트 롤아웃 차량" }]);
    expect(metadata.twitter?.images).toEqual([sourceUrl]);
  });

  it("uses the same rollout-compatible projection for detail JSON-LD and client payload", async () => {
    mocks.findUnique.mockResolvedValue(vehicle());

    const markup = renderToStaticMarkup(await CarDetailPage({
      params: Promise.resolve({ slug: "rollout-car" }),
    }));
    const payload = new DOMParser().parseFromString(markup, "text/html")
      .querySelector("#vehicle-payload")?.textContent ?? "{}";

    expect(JSON.parse(payload)).toMatchObject({
      thumbnailUrl: sourceUrl,
      legacyImageFallbackAllowed: false,
      heroImageProjectionAllowed: true,
      images: [{ storageUrl: managedImage.storageUrl }],
    });
    expect(mocks.buildJsonLd).toHaveBeenCalledWith(expect.objectContaining({ thumbnailUrl: sourceUrl }));
  });
});
