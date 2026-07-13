import type { Vehicle } from "@prisma/client";

export type VehicleImageRevision = Pick<
  Vehicle,
  "id" | "thumbnailImageId" | "thumbnailUrl" | "imageRevision" | "updatedAt"
>;

type VehicleImageRevisionSource = Pick<Vehicle, "id">;
type VehicleImageRevisionPatch = {
  readonly thumbnailImageId?: string | null;
  readonly thumbnailUrl?: string;
};
type VehicleImageRevisionUpdate = {
  readonly where: { readonly id: string };
  readonly data: VehicleImageRevisionPatch & { readonly imageRevision: { readonly increment: 1 } };
  readonly select: {
    readonly id: true;
    readonly thumbnailImageId: true;
    readonly thumbnailUrl: true;
    readonly imageRevision: true;
    readonly updatedAt: true;
  };
};
type VehicleImageRevisionClient = {
  readonly vehicle: {
    readonly update: (input: VehicleImageRevisionUpdate) => Promise<VehicleImageRevision>;
  };
};

export function advanceVehicleImageRevision(
  client: VehicleImageRevisionClient,
  vehicle: VehicleImageRevisionSource,
  patch: VehicleImageRevisionPatch = {},
): Promise<VehicleImageRevision> {
  return client.vehicle.update({
    where: { id: vehicle.id },
    data: { ...patch, imageRevision: { increment: 1 } },
    select: {
      id: true,
      thumbnailImageId: true,
      thumbnailUrl: true,
      imageRevision: true,
      updatedAt: true,
    },
  });
}
