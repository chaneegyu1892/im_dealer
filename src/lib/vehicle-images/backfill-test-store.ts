import type {
  BackfillStore,
  BackfillVehicle,
  VehicleBackfillPlan,
} from "./backfill";

class BackfillFixtureError extends Error { readonly name = "BackfillFixtureError"; }

export class MemoryBackfillStore implements BackfillStore {
  readonly states = new Map<string, BackfillVehicle>();
  writes = 0;
  fail = false;
  planCalls = 0;

  constructor(initial: readonly BackfillVehicle[]) {
    initial.forEach((item) => this.states.set(item.id, item));
  }

  async listVehicleIds(): Promise<readonly string[]> {
    return [...this.states.keys()].sort();
  }

  async loadVehicle(id: string): Promise<BackfillVehicle> {
    const state = this.states.get(id);
    if (!state) throw new BackfillFixtureError("fixture missing");
    return structuredClone(state);
  }

  async planVehicle(id: string, planner: (snapshot: BackfillVehicle) => VehicleBackfillPlan) {
    this.planCalls += 1;
    return planner(await this.loadVehicle(id));
  }

  async applyVehicle(id: string, planner: (snapshot: BackfillVehicle) => VehicleBackfillPlan) {
    const before = await this.loadVehicle(id);
    const plan = planner(before);
    if (this.fail) throw new BackfillFixtureError("forced rollback");
    const created = plan.creates.map((entry, index) => ({
      ...entry,
      id: `created-${index}`,
      origin: "ADMIN" as const,
      deletedAt: null,
      isVisible: true,
    }));
    let selectedId: string | null;
    if (plan.selection.kind === "legacy") {
      const key = plan.selection.sourceKey;
      selectedId = created.find((entry) => entry.sourceKey === key)?.id ?? null;
    } else {
      selectedId = plan.selection.imageId;
    }
    const writes = created.length + Number(plan.vehicleUpdate);
    const next = {
      ...before,
      imageRevision: writes === 0 ? before.imageRevision : before.imageRevision + 1,
      images: [...before.images, ...created],
    };
    if (plan.vehicleUpdate && selectedId) {
      next.thumbnailImageId = selectedId;
      next.thumbnailUrl = plan.selection.url;
    }
    this.states.set(id, next);
    this.writes += writes;
    return { plan, writes };
  }
}
