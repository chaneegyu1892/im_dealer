export const activeVehicle = {
  id: "vehicle-active",
  slug: "active-car",
  name: "활성 차량",
  brand: "테스트",
  category: "SUV",
  vehicleCode: null,
  basePrice: 40_000_000,
  thumbnailUrl: "https://cdn.example/representative.jpg",
  thumbnailImageId: null,
  thumbnailImage: null,
  imageUrls: ["https://cdn.example/legacy.jpg"],
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

export type PublicImageQuery = {
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

export type FindVehicleQuery = {
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

export function serializeRepresentative(
  query: FindVehicleQuery,
  image: RepresentativeImageState | null,
): RepresentativeImageState | null {
  const select = query.include?.thumbnailImage?.select;
  return select?.vehicleId && select.isVisible && select.deletedAt && select.storageUrl ? image : null;
}

const imageRows = [
  { id: "image-cover", type: "COVER", title: "커버", sourceUrl: "https://source.example/cover.jpg", storageUrl: "https://cdn.example/cover.jpg", displayOrder: 0, isVisible: true, deletedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
  { id: "image-main", type: "MAIN", title: "메인", sourceUrl: "https://source.example/main.jpg", storageUrl: "https://cdn.example/main.jpg", displayOrder: 0, isVisible: true, deletedAt: null, createdAt: new Date("2026-01-01T00:00:00.000Z") },
  { id: "image-hidden", type: "MAIN", title: "숨김", sourceUrl: "https://source.example/hidden.jpg", storageUrl: "https://cdn.example/hidden.jpg", displayOrder: -2, isVisible: false, deletedAt: null, createdAt: new Date("2025-01-01T00:00:00.000Z") },
  { id: "image-deleted", type: "COVER", title: "삭제", sourceUrl: "https://source.example/deleted.jpg", storageUrl: "https://cdn.example/deleted.jpg", displayOrder: -1, isVisible: true, deletedAt: new Date("2026-02-01T00:00:00.000Z"), createdAt: new Date("2025-01-01T00:00:00.000Z") },
] as const;

export function serializeImages(query: PublicImageQuery | undefined) {
  const filtersActive = query?.where?.isVisible === true && query.where.deletedAt === null;
  const ordersDeterministically = JSON.stringify(query?.orderBy) === JSON.stringify([
    { displayOrder: "asc" },
    { createdAt: "asc" },
    { id: "asc" },
  ]);
  const rows = filtersActive
    ? imageRows.filter((image) => image.isVisible && image.deletedAt === null)
    : imageRows;
  const ordered = ordersDeterministically
    ? [...rows].sort((left, right) => left.displayOrder - right.displayOrder
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.id.localeCompare(right.id))
    : rows;
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

export function rateMatrix(value: number) {
  return {
    "36_10000": value,
    "36_20000": value,
    "36_30000": value,
    "48_10000": value,
    "48_20000": value,
    "48_30000": value,
    "60_10000": value,
    "60_20000": value,
    "60_30000": value,
  };
}

export function managedPrimaryCount(query: FindVehicleQuery, count: number): number {
  const where = query.include?._count?.select?.images?.where;
  const directTypes = typeof where?.type === "object" ? where.type.in : [];
  const orTypes = where?.OR?.map((item) => item.type) ?? [];
  const types = [...(directTypes ?? []), ...orTypes];
  return types.includes("MAIN") && types.includes("COVER") ? count : 0;
}
