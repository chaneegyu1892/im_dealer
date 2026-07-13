import type {
  BackfillStore,
  CoverBackfillReport,
  VehicleBackfillPlan,
} from "./backfill-types";
import { planVehicleBackfill } from "./backfill-plan";

export {
  BackfillVehicleMissingError,
  createPrismaBackfillStore,
  isEligibleBackfillProjection,
  lockBackfillRows,
  readBackfillProjection,
} from "./backfill-prisma";
export { LegacyImageConflictError, legacySourceKey, planVehicleBackfill } from "./backfill-plan";
export type {
  AppliedVehicleBackfill,
  BackfillImage,
  BackfillSelection,
  BackfillStore,
  BackfillVehicle,
  CoverBackfillReport,
  LegacyImageCreate,
  VehicleBackfillPlan,
} from "./backfill-types";

type RunBackfillRequest = {
  readonly store: BackfillStore;
  readonly mode: "dry-run" | "apply";
};

function plannedWrites(plan: VehicleBackfillPlan): number {
  return plan.creates.length + Number(plan.vehicleUpdate);
}

export async function runCoverBackfill(request: RunBackfillRequest): Promise<CoverBackfillReport> {
  const vehicleIds = await request.store.listVehicleIds();
  const plans: VehicleBackfillPlan[] = [];
  let writes = 0;
  for (const vehicleId of vehicleIds) {
    if (request.mode === "dry-run") {
      plans.push(await request.store.planVehicle(vehicleId, planVehicleBackfill));
      continue;
    }
    const applied = await request.store.applyVehicle(vehicleId, planVehicleBackfill);
    plans.push(applied.plan);
    writes += applied.writes;
  }
  return {
    version: "carpan2-cover-backfill-v1",
    mode: request.mode,
    counts: {
      vehicles: plans.length,
      plannedCreates: plans.reduce((sum, plan) => sum + plan.creates.length, 0),
      plannedVehicleUpdates: plans.filter((plan) => plan.vehicleUpdate).length,
      missingCandidates: plans.filter((plan) => plan.missing).length,
      invalidCandidates: plans.reduce((sum, plan) => sum + plan.invalidCandidateCount, 0),
      blockedLegacyUrls: plans.reduce((sum, plan) => sum + plan.blockedLegacyUrlCount, 0),
      migrationRequired: plans.filter((plan) => plan.migrationRequired).length,
      writes,
    },
    changedSamples: plans
      .filter((plan) => plannedWrites(plan) > 0)
      .slice(0, 25)
      .map((plan) => ({ id: plan.vehicleId, name: plan.vehicleName })),
    preservedCustom: plans
      .filter((plan) => plan.preservedCustom)
      .map((plan) => ({ id: plan.vehicleId, name: plan.vehicleName, url: plan.selection.url })),
  };
}
