import type { Prisma, VehicleImageType } from "@prisma/client";

export const publicVehicleImagesArgs = {
  where: {
    isVisible: true,
    deletedAt: null,
  },
  orderBy: [
    { displayOrder: "asc" },
    { createdAt: "asc" },
    { id: "asc" },
  ],
  select: {
    id: true,
    type: true,
    title: true,
    storageUrl: true,
    displayOrder: true,
  },
} as const satisfies Prisma.Vehicle$imagesArgs;

const primaryImageWhere = {
  OR: [{ type: "MAIN" }, { type: "COVER" }],
} satisfies Prisma.VehicleImageWhereInput;

const publicVehicleImageStateWhere = {
  OR: [
    { isVisible: true, deletedAt: null },
    { type: "MAIN" },
    { type: "COVER" },
  ],
} satisfies Prisma.VehicleImageWhereInput;

const publicThumbnailImageArgs = {
  select: {
    vehicleId: true,
    isVisible: true,
    deletedAt: true,
    storageUrl: true,
  },
} as const satisfies Prisma.Vehicle$thumbnailImageArgs;

const publicPrimaryImageCountArgs = {
  select: {
    images: { where: primaryImageWhere },
  },
} as const satisfies Prisma.VehicleCountOutputTypeArgs;

export const publicThumbnailPrimaryImagesArgs = {
  where: primaryImageWhere,
  select: {
    type: true,
    sourceUrl: true,
    storageUrl: true,
    isVisible: true,
    deletedAt: true,
  },
} as const satisfies Prisma.Vehicle$imagesArgs;

const publicVehicleImageStateArgs = {
  where: publicVehicleImageStateWhere,
  orderBy: publicVehicleImagesArgs.orderBy,
  select: {
    ...publicVehicleImagesArgs.select,
    sourceUrl: true,
    isVisible: true,
    deletedAt: true,
  },
} as const satisfies Prisma.Vehicle$imagesArgs;

export const publicThumbnailProjectionInclude = {
  images: publicThumbnailPrimaryImagesArgs,
  thumbnailImage: publicThumbnailImageArgs,
  _count: publicPrimaryImageCountArgs,
} as const satisfies Prisma.VehicleInclude;

export const publicThumbnailProjectionSelect = {
  thumbnailUrl: true,
  thumbnailImageId: true,
  ...publicThumbnailProjectionInclude,
} as const satisfies Prisma.VehicleSelect;

export const publicVehicleImageStateInclude = {
  images: publicVehicleImageStateArgs,
  thumbnailImage: publicThumbnailImageArgs,
  _count: publicPrimaryImageCountArgs,
} as const satisfies Prisma.VehicleInclude;

export function canUseLegacyImageFallback(vehicle: {
  readonly thumbnailImageId: string | null;
  readonly _count: { readonly images: number };
}): boolean {
  return vehicle.thumbnailImageId === null && vehicle._count.images === 0;
}

export function resolvePublicThumbnailUrl(vehicle: {
  readonly id: string;
  readonly thumbnailUrl: string;
  readonly thumbnailImageId: string | null;
  readonly thumbnailImage: {
    readonly vehicleId: string;
    readonly isVisible: boolean;
    readonly deletedAt: Date | null;
    readonly storageUrl: string;
  } | null;
  readonly images: readonly {
    readonly type: VehicleImageType;
    readonly sourceUrl: string | null;
    readonly storageUrl: string;
    readonly isVisible: boolean;
    readonly deletedAt: Date | null;
  }[];
  readonly _count: { readonly images: number };
}): string {
  const thumbnailUrl = vehicle.thumbnailUrl.trim();
  if (thumbnailUrl.length === 0) return "";

  const linkedImage = vehicle.thumbnailImage;
  if (vehicle.thumbnailImageId !== null) {
    const activeLinkedProjection = linkedImage !== null
    && linkedImage.vehicleId === vehicle.id
    && linkedImage.isVisible
    && linkedImage.deletedAt === null
    && linkedImage.storageUrl.trim() === thumbnailUrl;
    return activeLinkedProjection ? thumbnailUrl : "";
  }

  const matchingPrimaryImages = vehicle.images.filter((image) =>
    (image.type === "MAIN" || image.type === "COVER")
    && (image.storageUrl.trim() === thumbnailUrl || image.sourceUrl?.trim() === thumbnailUrl));
  if (matchingPrimaryImages.length === 0) return thumbnailUrl;
  return matchingPrimaryImages.some((image) => image.isVisible && image.deletedAt === null)
    ? thumbnailUrl
    : "";
}

export function resolvePublicVehicleImages(images: readonly {
  readonly id: string;
  readonly type: VehicleImageType;
  readonly title: string | null;
  readonly storageUrl: string;
  readonly displayOrder: number;
  readonly isVisible: boolean;
  readonly deletedAt: Date | null;
}[]): {
  readonly id: string;
  readonly type: VehicleImageType;
  readonly title: string | null;
  readonly storageUrl: string;
  readonly displayOrder: number;
}[] {
  return images
    .filter((image) => image.isVisible && image.deletedAt === null)
    .map(({ id, type, title, storageUrl, displayOrder }) => ({
      id,
      type,
      title,
      storageUrl,
      displayOrder,
    }));
}
