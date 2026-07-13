import type { VehicleImageType as PrismaVehicleImageType } from "@prisma/client";

export const VEHICLE_IMAGE_TYPES = [
  "MAIN",
  "COVER",
  "EXTERIOR_COLOR",
  "INTERIOR_COLOR",
  "SPEC_EXTERIOR",
  "SPEC_INTERIOR",
  "SPEC_SEAT",
  "SPEC_OPTION",
  "CATALOG_PAGE",
] as const satisfies readonly PrismaVehicleImageType[];

export type VehicleImageTypeValue = PrismaVehicleImageType;

export const IMAGE_GROUP_NAMES = [
  "PRIMARY",
  "EXTERIOR_COLOR",
  "INTERIOR_COLOR",
  "SPEC_EXTERIOR",
  "SPEC_INTERIOR",
  "SPEC_SEAT",
  "SPEC_OPTION",
  "CATALOG_PAGE",
] as const;

export type VehicleImageGroup = (typeof IMAGE_GROUP_NAMES)[number];

const IMAGE_TYPE_TO_GROUP = {
  MAIN: "PRIMARY",
  COVER: "PRIMARY",
  EXTERIOR_COLOR: "EXTERIOR_COLOR",
  INTERIOR_COLOR: "INTERIOR_COLOR",
  SPEC_EXTERIOR: "SPEC_EXTERIOR",
  SPEC_INTERIOR: "SPEC_INTERIOR",
  SPEC_SEAT: "SPEC_SEAT",
  SPEC_OPTION: "SPEC_OPTION",
  CATALOG_PAGE: "CATALOG_PAGE",
} as const satisfies Record<PrismaVehicleImageType, VehicleImageGroup>;

export const IMAGE_GROUP_TYPES = {
  PRIMARY: ["MAIN", "COVER"],
  EXTERIOR_COLOR: ["EXTERIOR_COLOR"],
  INTERIOR_COLOR: ["INTERIOR_COLOR"],
  SPEC_EXTERIOR: ["SPEC_EXTERIOR"],
  SPEC_INTERIOR: ["SPEC_INTERIOR"],
  SPEC_SEAT: ["SPEC_SEAT"],
  SPEC_OPTION: ["SPEC_OPTION"],
  CATALOG_PAGE: ["CATALOG_PAGE"],
} as const satisfies Record<VehicleImageGroup, readonly VehicleImageTypeValue[]>;

type GroupRow = {
  readonly id: string;
  readonly vehicleId: string;
  readonly type: VehicleImageTypeValue;
  readonly displayOrder: number;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
};

export type ImageOrderAssignment = {
  readonly id: string;
  readonly type?: VehicleImageTypeValue;
  readonly displayOrder: number;
};

export type VehicleImageGroupPolicyCode =
  | "IMAGE_GROUP_SET_MISMATCH"
  | "IMAGE_NOT_FOUND";

export class VehicleImageGroupPolicyError extends Error {
  readonly name = "VehicleImageGroupPolicyError";
  readonly status = 409;

  constructor(readonly code: VehicleImageGroupPolicyCode) {
    super(code);
  }
}

export function getVehicleImageGroup(type: VehicleImageTypeValue): VehicleImageGroup {
  return IMAGE_TYPE_TO_GROUP[type];
}

export function applyCompleteGroupOrder(
  vehicleId: string,
  group: VehicleImageGroup,
  payloadIds: readonly string[],
  rows: readonly GroupRow[],
): readonly ImageOrderAssignment[] {
  const activeIds = rows
    .filter((row) => row.vehicleId === vehicleId && row.deletedAt === null && getVehicleImageGroup(row.type) === group)
    .map((row) => row.id)
    .sort();
  const requestedIds = [...payloadIds].sort();
  const exactSet = activeIds.length === requestedIds.length
    && activeIds.every((id, index) => id === requestedIds[index]);
  if (!exactSet) throw new VehicleImageGroupPolicyError("IMAGE_GROUP_SET_MISMATCH");
  return payloadIds.map((id, displayOrder) => ({ id, displayOrder }));
}

export function planImageTypeMove(
  vehicleId: string,
  imageId: string,
  targetType: VehicleImageTypeValue,
  rows: readonly GroupRow[],
): readonly ImageOrderAssignment[] {
  const image = rows.find((row) => row.id === imageId && row.vehicleId === vehicleId && row.deletedAt === null);
  if (!image) throw new VehicleImageGroupPolicyError("IMAGE_NOT_FOUND");
  const sourceGroup = getVehicleImageGroup(image.type);
  const targetGroup = getVehicleImageGroup(targetType);
  if (sourceGroup === targetGroup) {
    return [{ id: image.id, type: targetType, displayOrder: image.displayOrder }];
  }
  const ordered = rows
    .filter((row) => row.vehicleId === vehicleId && row.deletedAt === null)
    .toSorted((left, right) => left.displayOrder - right.displayOrder
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.id.localeCompare(right.id));
  const source = ordered.filter((row) => getVehicleImageGroup(row.type) === sourceGroup && row.id !== image.id);
  const target = ordered.filter((row) => getVehicleImageGroup(row.type) === targetGroup);
  return [
    ...source.map((row, displayOrder) => ({ id: row.id, displayOrder })),
    ...target.map((row, displayOrder) => ({ id: row.id, displayOrder })),
    { id: image.id, type: targetType, displayOrder: target.length },
  ];
}
