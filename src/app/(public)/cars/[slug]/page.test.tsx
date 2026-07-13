import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  buildJsonLd: vi.fn((input: unknown) => [input]),
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
    <script id="vehicle-payload" type="application/json">
      {JSON.stringify(vehicle)}
    </script>
  ),
}));

import CarDetailPage from "./page";

type PublicImageQuery = {
  readonly where?: {
    readonly isVisible?: boolean;
    readonly deletedAt?: null;
    readonly OR?: readonly {
      readonly isVisible?: boolean;
      readonly deletedAt?: null;
      readonly type?: string;
    }[];
  };
  readonly orderBy?: readonly Record<string, "asc" | "desc">[];
};

type FindVehicleQuery = {
  readonly include?: {
    readonly images?: PublicImageQuery;
    readonly thumbnailImage?: {
      readonly select?: {
        readonly vehicleId?: boolean;
        readonly isVisible?: boolean;
        readonly deletedAt?: boolean;
        readonly storageUrl?: boolean;
      };
    };
    readonly _count?: {
      readonly select?: {
        readonly images?: {
          readonly where?: {
            readonly type?: { readonly in?: readonly string[] } | string;
            readonly OR?: readonly { readonly type?: string }[];
          };
        };
      };
    };
  };
};

type RepresentativeImageState = {
  readonly vehicleId: string;
  readonly isVisible: boolean;
  readonly deletedAt: Date | null;
  readonly storageUrl: string;
};

const rows = [
  { id: "main-b", type: "MAIN", title: "B", sourceUrl: "/source-b.jpg", storageUrl: "/b.jpg", displayOrder: 0, isVisible: true, deletedAt: null, createdAt: new Date("2026-01-01") },
  { id: "main-a", type: "MAIN", title: "A", sourceUrl: "/source-a.jpg", storageUrl: "/a.jpg", displayOrder: 0, isVisible: true, deletedAt: null, createdAt: new Date("2026-01-01") },
  { id: "hidden", type: "MAIN", title: "숨김", sourceUrl: "/hidden-source.jpg", storageUrl: "/hidden.jpg", displayOrder: -2, isVisible: false, deletedAt: null, createdAt: new Date("2025-01-01") },
  { id: "deleted", type: "COVER", title: "삭제", sourceUrl: "/deleted-source.jpg", storageUrl: "/deleted.jpg", displayOrder: -1, isVisible: true, deletedAt: new Date("2026-02-01"), createdAt: new Date("2025-01-01") },
] as const;

function queriedImages(query: PublicImageQuery | undefined) {
  const active = query?.where?.isVisible === true && query.where.deletedAt === null;
  const deterministic = JSON.stringify(query?.orderBy) === JSON.stringify([
    { displayOrder: "asc" },
    { createdAt: "asc" },
    { id: "asc" },
  ]);
  const selected = active ? rows.filter((row) => row.isVisible && row.deletedAt === null) : rows;
  const ordered = deterministic
    ? [...selected].sort((left, right) => left.displayOrder - right.displayOrder
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.id.localeCompare(right.id))
    : selected;
  return ordered.map(({ id, type, title, sourceUrl, storageUrl, displayOrder, isVisible, deletedAt }) => ({
    id,
    type,
    title,
    sourceUrl,
    storageUrl,
    displayOrder,
    isVisible,
    deletedAt,
  }));
}

function managedPrimaryCount(query: FindVehicleQuery, count: number): number {
  const where = query.include?._count?.select?.images?.where;
  const directTypes = typeof where?.type === "object" ? where.type.in : [];
  const orTypes = where?.OR?.map((item) => item.type) ?? [];
  const types = [...(directTypes ?? []), ...orTypes];
  return types?.includes("MAIN") && types.includes("COVER") ? count : 0;
}

function queriedRepresentative(
  query: FindVehicleQuery,
  image: RepresentativeImageState | null,
): RepresentativeImageState | null {
  const select = query.include?.thumbnailImage?.select;
  return select?.vehicleId && select.isVisible && select.deletedAt && select.storageUrl ? image : null;
}

describe("public car detail SSR", () => {
  it("serializes the same active deterministic image shape as VehicleDetail", async () => {
    mocks.findUnique.mockImplementation(async (query: FindVehicleQuery) => ({
      id: "vehicle",
      slug: "test-car",
      name: "테스트카",
      brand: "테스트",
      category: "SUV",
      vehicleCode: null,
      basePrice: 40_000_000,
      thumbnailUrl: "/representative.jpg",
      thumbnailImageId: null,
      thumbnailImage: queriedRepresentative(query, null),
      imageUrls: [],
      surchargeRate: 0,
      isVisible: true,
      isPopular: false,
      description: null,
      detailedSpecs: null,
      trims: [],
      recConfigs: null,
      images: queriedImages(query.include?.images),
      _count: { images: managedPrimaryCount(query, rows.length) },
    }));

    const markup = renderToStaticMarkup(await CarDetailPage({
      params: Promise.resolve({ slug: "test-car" }),
    }));
    const document = new DOMParser().parseFromString(markup, "text/html");
    const payload = document.querySelector("#vehicle-payload")?.textContent ?? "";

    expect(JSON.parse(payload).images).toEqual([
      { id: "main-a", type: "MAIN", title: "A", storageUrl: "/a.jpg", displayOrder: 0 },
      { id: "main-b", type: "MAIN", title: "B", storageUrl: "/b.jpg", displayOrder: 0 },
    ]);
    expect(payload).not.toContain("hidden.jpg");
    expect(payload).not.toContain("deleted.jpg");
  });

});
