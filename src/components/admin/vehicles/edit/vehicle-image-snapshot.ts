import type { AdminVehicleDetail } from "@/types/admin";
import type { VehicleImageSnapshot } from "./images/ImageTab";

export type VehicleImageSnapshotState = {
  readonly vehicleId: string;
  readonly snapshot: VehicleImageSnapshot;
  readonly imageRevision: number;
  readonly epoch: number;
};

function isStrictlyNewer(incoming: string, current: string): boolean {
  return Date.parse(incoming) > Date.parse(current);
}

export function snapshotFromVehicle(vehicle: AdminVehicleDetail): VehicleImageSnapshot {
  return {
    images: vehicle.images,
    thumbnailImageId: vehicle.thumbnailImageId,
    thumbnailUrl: vehicle.thumbnailUrl,
    updatedAt: vehicle.updatedAt,
    imageRevision: vehicle.imageRevision,
  };
}

export function initialSnapshotState(vehicle: AdminVehicleDetail): VehicleImageSnapshotState {
  return {
    vehicleId: vehicle.id,
    snapshot: snapshotFromVehicle(vehicle),
    imageRevision: vehicle.imageRevision,
    epoch: 0,
  };
}

export function reconcileServerSnapshot(
  state: VehicleImageSnapshotState,
  vehicle: AdminVehicleDetail
): VehicleImageSnapshotState {
  if (state.vehicleId !== vehicle.id) {
    return { ...initialSnapshotState(vehicle), epoch: state.epoch + 1 };
  }
  if (vehicle.imageRevision > state.imageRevision) {
    return {
      vehicleId: vehicle.id,
      snapshot: snapshotFromVehicle(vehicle),
      imageRevision: vehicle.imageRevision,
      epoch: state.epoch + 1,
    };
  }
  if (vehicle.imageRevision !== state.imageRevision) return state;
  if (!isStrictlyNewer(vehicle.updatedAt, state.snapshot.updatedAt)) return state;
  return {
    ...state,
    snapshot: { ...state.snapshot, updatedAt: vehicle.updatedAt },
    epoch: state.epoch + 1,
  };
}

export function publishLocalSnapshot(
  state: VehicleImageSnapshotState,
  vehicleId: string,
  epoch: number,
  snapshot: VehicleImageSnapshot
): VehicleImageSnapshotState {
  if (state.vehicleId !== vehicleId || state.epoch !== epoch) return state;
  if (snapshot.imageRevision < state.imageRevision) return state;
  if (snapshot.imageRevision === state.imageRevision) {
    if (!isStrictlyNewer(snapshot.updatedAt, state.snapshot.updatedAt)) return state;
    return {
      ...state,
      snapshot: { ...state.snapshot, updatedAt: snapshot.updatedAt },
      epoch: state.epoch + 1,
    };
  }
  return {
    ...state,
    snapshot,
    imageRevision: snapshot.imageRevision,
    epoch: state.epoch + 1,
  };
}
