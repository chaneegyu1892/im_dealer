import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyVehicles: vi.fn(),
  findManyInventory: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findMany: mocks.findManyVehicles },
    inventory: { findMany: mocks.findManyInventory },
  },
}));
vi.mock("@/lib/admin-queries", () => ({ getHomeTopLikedReviews: vi.fn(async () => []) }));
vi.mock("@/lib/brand-signals", () => ({ getBrandSignals: vi.fn(async () => new Map()) }));
vi.mock("@/lib/representative-quote-query", () => ({
  getRepresentativeQuotesByVehicle: vi.fn(async () => new Map()),
}));
vi.mock("@/components/home/HeroSectionV2", () => ({
  HeroSectionV2: ({ featuredVehicle }: { readonly featuredVehicle: unknown }) => (
    <script id="home-thumbnail-payload" type="application/json">
      {JSON.stringify(featuredVehicle)}
    </script>
  ),
}));
vi.mock("@/components/home/PopularCarsSectionV2", () => ({
  PopularCarsSectionV2: ({ vehicles }: { readonly vehicles: unknown }) => (
    <script id="home-list-thumbnail-payload" type="application/json">{JSON.stringify(vehicles)}</script>
  ),
}));
vi.mock("@/components/home/CustomerReviewsSection", () => ({
  CustomerReviewsSection: () => null,
}));
vi.mock("@/components/home/ServiceIntroSection", () => ({ ServiceIntroSection: () => null }));
vi.mock("./cars/CarsClientPage", () => ({
  CarsClientPage: ({ vehicles }: { readonly vehicles: unknown }) => (
    <script id="cars-thumbnail-payload" type="application/json">{JSON.stringify(vehicles)}</script>
  ),
}));
vi.mock("./quote/QuoteClientPageV2", () => ({
  QuoteClientPageV2: ({ vehicles }: { readonly vehicles: unknown }) => (
    <script id="quote-thumbnail-payload" type="application/json">{JSON.stringify(vehicles)}</script>
  ),
}));

import HomePage from "./page";
import CarsPage from "./cars/page";
import QuotePage from "./quote/page";

const activeImage = {
  isVisible: true,
  deletedAt: null,
  storageUrl: "https://cdn.example/active.webp",
} as const;

const primary = (overrides: {
  readonly sourceUrl?: string | null;
  readonly storageUrl?: string;
  readonly isVisible?: boolean;
  readonly deletedAt?: Date | null;
} = {}) => ({
  type: "COVER" as const,
  sourceUrl: "/managed-source.webp",
  storageUrl: "/managed-mirror.webp",
  isVisible: true,
  deletedAt: null,
  ...overrides,
});

const vehicles = [
  {
    id: "active",
    slug: "active",
    name: "활성 차량",
    brand: "테스트",
    category: "SUV",
    basePrice: 40_000_000,
    thumbnailUrl: activeImage.storageUrl,
    thumbnailImageId: "image-active",
    thumbnailImage: { vehicleId: "active", ...activeImage },
    images: [primary({ storageUrl: activeImage.storageUrl })],
    _count: { images: 1 },
    isPopular: true,
    isSpotlight: true,
    description: null,
    displayOrder: 0,
    tags: [],
    surchargeRate: 0,
    trims: [],
    recConfigs: null,
  },
  {
    id: "legacy",
    slug: "legacy",
    name: "레거시 차량",
    brand: "테스트",
    category: "SUV",
    basePrice: 40_000_000,
    thumbnailUrl: "/legacy.webp",
    thumbnailImageId: null,
    thumbnailImage: null,
    images: [],
    _count: { images: 0 },
    isPopular: true,
    isSpotlight: false,
    description: null,
    displayOrder: 1,
    tags: [],
    surchargeRate: 0,
    trims: [],
    recConfigs: null,
  },
  {
    id: "custom",
    slug: "custom",
    name: "커스텀 차량",
    brand: "테스트",
    category: "SUV",
    basePrice: 40_000_000,
    thumbnailUrl: "/custom-407.webp",
    thumbnailImageId: null,
    thumbnailImage: null,
    images: [primary()],
    _count: { images: 1 },
    isPopular: true,
    isSpotlight: false,
    description: null,
    displayOrder: 2,
    tags: [],
    surchargeRate: 0,
    trims: [],
    recConfigs: null,
  },
  {
    id: "managed-active",
    slug: "managed-active",
    name: "백필 대기 차량",
    brand: "테스트",
    category: "SUV",
    basePrice: 40_000_000,
    thumbnailUrl: "/managed-source.webp",
    thumbnailImageId: null,
    thumbnailImage: null,
    images: [primary()],
    _count: { images: 1 },
    isPopular: true,
    isSpotlight: false,
    description: null,
    displayOrder: 3,
    tags: [],
    surchargeRate: 0,
    trims: [],
    recConfigs: null,
  },
  {
    id: "managed-hidden",
    slug: "managed-hidden",
    name: "숨김 관리 차량",
    brand: "테스트",
    category: "SUV",
    basePrice: 40_000_000,
    thumbnailUrl: "/managed-source.webp",
    thumbnailImageId: null,
    thumbnailImage: null,
    images: [primary({ isVisible: false })],
    _count: { images: 1 },
    isPopular: true,
    isSpotlight: false,
    description: null,
    displayOrder: 4,
    tags: [],
    surchargeRate: 0,
    trims: [],
    recConfigs: null,
  },
] as const;

function payload(markup: string, id: string): readonly { readonly thumbnailUrl: string }[] {
  const text = new DOMParser().parseFromString(markup, "text/html")
    .querySelector(`#${id}`)?.textContent ?? "[]";
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) throw new TypeError("vehicle payload must be an array");
  return value;
}

function expectProjection(rows: readonly { readonly thumbnailUrl: string }[]) {
  expect(rows.map((row) => row.thumbnailUrl)).toEqual([
    "https://cdn.example/active.webp",
    "/legacy.webp",
    "/custom-407.webp",
    "/managed-source.webp",
    "",
  ]);
}

describe("public thumbnail server surfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findManyVehicles.mockResolvedValue(vehicles);
    mocks.findManyInventory.mockResolvedValue([]);
  });

  it("sanitizes the home hero before passing data to client components", async () => {
    const markup = renderToStaticMarkup(await HomePage());
    const featured = new DOMParser().parseFromString(markup, "text/html")
      .querySelector("#home-thumbnail-payload")?.textContent ?? "{}";
    expect(JSON.parse(featured).thumbnailUrl).toBe("https://cdn.example/active.webp");
    expectProjection(payload(markup, "home-list-thumbnail-payload"));
    expect(mocks.findManyVehicles.mock.calls[0]?.[0].include).toHaveProperty("thumbnailImage");
  });

  it("preserves rollout-compatible thumbnails and denies inactive exact matches on the cars page", async () => {
    const markup = renderToStaticMarkup(await CarsPage({}));
    expectProjection(payload(markup, "cars-thumbnail-payload"));
    expect(mocks.findManyVehicles.mock.calls[0]?.[0].select).toHaveProperty("_count");
  });

  it("preserves rollout-compatible thumbnails and denies inactive exact matches on the quote page", async () => {
    const markup = renderToStaticMarkup(await QuotePage());
    expectProjection(payload(markup, "quote-thumbnail-payload"));
    expect(mocks.findManyVehicles.mock.calls[0]?.[0].include).toHaveProperty("thumbnailImage");
  });
});
