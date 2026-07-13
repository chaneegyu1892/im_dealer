import type { Prisma, VehicleImage, VehicleImageType } from "@prisma/client";
import type { VehicleImageEditInput, VehicleImageReorderInput } from "@/lib/validations/admin-vehicle-images";
import { applyCompleteGroupOrder, getVehicleImageGroup, IMAGE_GROUP_TYPES, planImageTypeMove } from "./groups";
import { assertImageVersion, assertMutationReady, assertVehicleImageRevision } from "./policy";
import { advanceVehicleImageRevision } from "./revision";
import { withLockedVehicleImages } from "./transaction";

type OrderingResult = {
  readonly before: readonly VehicleImage[];
  readonly images: readonly VehicleImage[];
  readonly imageRevision: number;
  readonly vehicleUpdatedAt: Date;
};

export async function applyImageEdit(
  tx: Prisma.TransactionClient,
  image: VehicleImage,
  input: VehicleImageEditInput,
): Promise<VehicleImage> {
  const targetType = input.type ?? image.type;
  const groups = [getVehicleImageGroup(image.type), getVehicleImageGroup(targetType)];
  const groupTypes = [...new Set(groups.flatMap((group) => IMAGE_GROUP_TYPES[group]))];
  const rows = await tx.vehicleImage.findMany({
    where: { vehicleId: image.vehicleId, deletedAt: null, type: { in: groupTypes } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const assignments = planImageTypeMove(image.vehicleId, image.id, targetType, rows);
  await Promise.all(assignments.map((assignment) => tx.vehicleImage.update({
    where: { id: assignment.id },
    data: {
      displayOrder: assignment.displayOrder,
      ...(assignment.type === undefined ? {} : { type: assignment.type }),
      ...(assignment.id === image.id && input.title !== undefined ? { title: input.title } : {}),
    },
  })));
  return tx.vehicleImage.findUniqueOrThrow({ where: { id: image.id } });
}

export async function reorderVehicleImages(
  vehicleId: string,
  input: VehicleImageReorderInput,
): Promise<OrderingResult> {
  const requestedIds = input.items.map((item) => item.id);
  return withLockedVehicleImages({
    vehicleId,
    requestedImageIds: requestedIds,
    lockScope: { kind: "known_groups", groupTypes: IMAGE_GROUP_TYPES[input.group] },
  }, async (tx) => {
    const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    assertMutationReady(vehicle);
    assertVehicleImageRevision(vehicle.imageRevision, input.expectedImageRevision);
    const rows = await tx.vehicleImage.findMany({
    where: { vehicleId, deletedAt: null, type: { in: [...IMAGE_GROUP_TYPES[input.group]] } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const expectedVersions = new Map(input.items.map((item) => [item.id, item.expectedUpdatedAt]));
    for (const row of rows) {
      const expected = expectedVersions.get(row.id);
      if (expected !== undefined) assertImageVersion(row.updatedAt, expected);
    }
    const assignments = applyCompleteGroupOrder(vehicleId, input.group, requestedIds, rows);
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const changed = assignments.some((assignment) => {
      const row = rowsById.get(assignment.id);
      return row === undefined
        || row.displayOrder !== assignment.displayOrder
        || (assignment.type !== undefined && row.type !== assignment.type);
    });
    if (changed) {
      await Promise.all(assignments.map((assignment) => tx.vehicleImage.update({
        where: { id: assignment.id },
        data: {
          displayOrder: assignment.displayOrder,
          // applyCompleteGroupOrder는 동일 그룹 내 reorder가 원칙이지만, 향후 type 변경이
          // 포함될 경우 changed 판단(line 67)과 update가 불일치하여 조용히 누락되는 것을 방지.
          ...(assignment.type === undefined ? {} : { type: assignment.type }),
        },
      })));
    }
    const images = await tx.vehicleImage.findMany({
      where: { vehicleId, deletedAt: null, type: { in: [...IMAGE_GROUP_TYPES[input.group]] } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const revision = changed ? await advanceVehicleImageRevision(tx, vehicle) : vehicle;
    return {
      before: rows,
      images,
      imageRevision: revision.imageRevision,
      vehicleUpdatedAt: revision.updatedAt,
    };
  });
}

export function editLockTypes(currentType: VehicleImageType, targetType?: VehicleImageType): readonly VehicleImageType[] {
  const groups = [getVehicleImageGroup(currentType), getVehicleImageGroup(targetType ?? currentType)];
  return [...new Set(groups.flatMap((group) => IMAGE_GROUP_TYPES[group]))];
}
