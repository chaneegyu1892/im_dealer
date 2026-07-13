import type { VehicleImageTypeValue } from "./groups";

export type BackfillImage = {
  readonly id: string;
  readonly type: VehicleImageTypeValue;
  readonly origin: "CARPAN2" | "ADMIN";
  readonly title: string | null;
  readonly storageUrl: string;
  readonly sourceUrl: string | null;
  readonly sourceKey: string;
  readonly adminStoragePath: string | null;
  readonly displayOrder: number;
  readonly isVisible: boolean;
  readonly deletedAt: Date | null;
};

export type BackfillVehicle = {
  readonly id: string;
  readonly name: string;
  readonly thumbnailUrl: string;
  readonly thumbnailImageId: string | null;
  readonly imageRevision: number;
  readonly updatedAt: Date;
  readonly imageUrls: readonly string[];
  readonly images: readonly BackfillImage[];
};

export type LegacyImageCreate = {
  readonly type: "MAIN";
  readonly origin: "ADMIN";
  readonly title: string;
  readonly storageUrl: string;
  readonly sourceUrl: string;
  readonly sourceKey: string;
  readonly adminStoragePath: null;
  readonly displayOrder: number;
  readonly isVisible: true;
};

export type BackfillSelection =
  | { readonly kind: "existing"; readonly imageId: string; readonly url: string }
  | { readonly kind: "legacy"; readonly sourceKey: string; readonly url: string }
  | { readonly kind: "preserve"; readonly imageId: string | null; readonly url: string };

export type VehicleBackfillPlan = {
  readonly vehicleId: string;
  readonly vehicleName: string;
  readonly classification: "blank" | "managed" | "custom";
  readonly creates: readonly LegacyImageCreate[];
  readonly selection: BackfillSelection;
  readonly vehicleUpdate: boolean;
  readonly preservedCustom: boolean;
  readonly missing: boolean;
  readonly invalidCandidateCount: number;
  readonly blockedLegacyUrlCount: number;
  readonly migrationRequired: boolean;
};

export type AppliedVehicleBackfill = {
  readonly plan: VehicleBackfillPlan;
  readonly writes: number;
};

export interface BackfillStore {
  listVehicleIds(): Promise<readonly string[]>;
  planVehicle(
    vehicleId: string,
    planner: (snapshot: BackfillVehicle) => VehicleBackfillPlan,
  ): Promise<VehicleBackfillPlan>;
  applyVehicle(
    vehicleId: string,
    planner: (snapshot: BackfillVehicle) => VehicleBackfillPlan,
  ): Promise<AppliedVehicleBackfill>;
}

export type CoverBackfillReport = {
  readonly version: "carpan2-cover-backfill-v1";
  readonly mode: "dry-run" | "apply";
  readonly counts: {
    readonly vehicles: number;
    readonly plannedCreates: number;
    readonly plannedVehicleUpdates: number;
    readonly missingCandidates: number;
    readonly invalidCandidates: number;
    readonly blockedLegacyUrls: number;
    readonly migrationRequired: number;
    readonly writes: number;
  };
  readonly changedSamples: readonly { readonly id: string; readonly name: string }[];
  readonly preservedCustom: readonly { readonly id: string; readonly name: string; readonly url: string }[];
};
