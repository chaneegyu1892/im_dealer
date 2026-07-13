import type { Vehicle, VehicleImage } from "@prisma/client";
import type { VehicleImageRepresentativeInput } from "@/lib/validations/admin-vehicle-images";
import { getVehicleImageGroup, IMAGE_GROUP_TYPES } from "./groups";
import {
  assertImageVersion,
  assertRepresentativeEligible,
  assertVehicleImageRevision,
  assertVehicleVersion,
} from "./policy";
import { advanceVehicleImageRevision, type VehicleImageRevision } from "./revision";
import { withLockedVehicleImages } from "./transaction";
import { VehicleImageMutationTargetError } from "./item-mutations";

type RepresentativeResult = {
  readonly before: Pick<Vehicle, "thumbnailImageId" | "thumbnailUrl" | "updatedAt">;
  readonly image: VehicleImage;
  readonly vehicle: VehicleImageRevision;
};

export async function setVehicleRepresentative(
  vehicleId: string,
  imageId: string,
  input: VehicleImageRepresentativeInput,
): Promise<RepresentativeResult> {
  return withLockedVehicleImages({
    vehicleId,
    requestedImageIds: [imageId],
    lockScope: {
      kind: "mutation_time_groups",
      resolve: async (tx) => {
        const image = await tx.vehicleImage.findUnique({ where: { id: imageId } });
        if (!image) throw new VehicleImageMutationTargetError();
        return IMAGE_GROUP_TYPES[getVehicleImageGroup(image.type)];
      },
    },
  }, async (tx) => {
    const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    const image = await tx.vehicleImage.findFirst({ where: { id: imageId, vehicleId } });
    if (!image) throw new VehicleImageMutationTargetError();
    assertVehicleImageRevision(vehicle.imageRevision, input.expectedImageRevision);
    assertImageVersion(image.updatedAt, input.expectedImageUpdatedAt);
    assertVehicleVersion(vehicle.updatedAt, input.expectedVehicleUpdatedAt);
    assertRepresentativeEligible(image);
    const before = {
      thumbnailImageId: vehicle.thumbnailImageId,
      thumbnailUrl: vehicle.thumbnailUrl,
      updatedAt: vehicle.updatedAt,
    };
    if (vehicle.thumbnailImageId === image.id && vehicle.thumbnailUrl === image.storageUrl) {
      return { before, image, vehicle };
    }
    const updated = await advanceVehicleImageRevision(tx, vehicle, {
      thumbnailImageId: image.id,
      thumbnailUrl: image.storageUrl,
    });
    return { before, image, vehicle: updated };
  });
}
