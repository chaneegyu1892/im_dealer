import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleImageTypeValue } from "./groups";

const rawCalls: Array<{ readonly query: string; readonly values: readonly unknown[] }> = [];
const failures: unknown[] = [];
const missingImageIds = new Set<string>();
let attempts = 0;
let vehicleExists = true;
let vehicleLock = Promise.resolve();

function request(imageIds: readonly string[] = [], groupTypes: readonly VehicleImageTypeValue[] = []) {
  return {
    vehicleId: "vehicle-1",
    requestedImageIds: imageIds,
    lockScope: { kind: "known_groups", groupTypes },
  } as const;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (
      operation: (tx: { readonly $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<readonly { readonly id: string }[]> }) => Promise<unknown>,
      options: unknown,
    ) => {
      attempts += 1;
      const failure = failures.shift();
      if (failure) throw failure;
      let releaseVehicle = (): void => undefined;
      let ownsVehicleLock = false;
      const transaction = {
        $queryRawUnsafe: async (query: string, ...values: unknown[]) => {
          rawCalls.push({ query, values });
          if (query.includes('FROM "Vehicle"')) {
            const previous = vehicleLock;
            vehicleLock = new Promise<void>((resolve) => { releaseVehicle = resolve; });
            await previous;
            ownsVehicleLock = true;
            return vehicleExists ? [{ id: "vehicle-1" }] : [];
          }
          const requested = Array.isArray(values[1])
            ? values[1].filter((value): value is string => typeof value === "string")
            : [];
          return requested.filter((id) => !missingImageIds.has(id)).map((id) => ({ id }));
        },
      };
      try {
        return await operation(transaction);
      } finally {
        if (ownsVehicleLock) releaseVehicle();
        expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      }
    },
  },
}));

import {
  ConcurrentImageMutationError,
  VehicleImageLockTargetError,
  withLockedVehicleImages,
} from "./transaction";
import {
  assertRepresentativeEligible,
  setImageVisibility,
  softDeleteImage,
} from "./policy";

describe("withLockedVehicleImages", () => {
  beforeEach(() => {
    rawCalls.length = 0;
    failures.length = 0;
    missingImageIds.clear();
    attempts = 0;
    vehicleExists = true;
    vehicleLock = Promise.resolve();
  });

  it("locks Vehicle first and mutation-time group members in sorted order", async () => {
    // Given
    const lockRequest = request(["z-image", "a-image"], ["COVER", "MAIN"]);

    // When
    const result = await withLockedVehicleImages(lockRequest, async () => "done");

    // Then
    expect(result).toBe("done");
    expect(rawCalls).toHaveLength(2);
    expect(rawCalls[0]?.query).toContain('FROM "Vehicle"');
    expect(rawCalls[1]?.query).toContain('ORDER BY "id" ASC FOR UPDATE');
    expect(rawCalls[1]?.values).toEqual(["vehicle-1", ["a-image", "z-image"], ["COVER", "MAIN"]]);
  });

  it("resolves a type-move lock scope only after the Vehicle lock", async () => {
    // Given
    const events: string[] = [];
    const lockRequest = {
      vehicleId: "vehicle-1",
      requestedImageIds: ["image-1"],
      lockScope: {
        kind: "mutation_time_groups" as const,
        resolve: async () => {
          events.push(rawCalls[0]?.query.includes('FROM "Vehicle"') ? "vehicle-locked" : "unlocked");
          return ["MAIN", "EXTERIOR_COLOR"] as const;
        },
      },
    };

    // When
    await withLockedVehicleImages(lockRequest, async () => { events.push("mutation"); });

    // Then
    expect(events).toEqual(["vehicle-locked", "mutation"]);
    expect(rawCalls[1]?.values[2]).toEqual(["EXTERIOR_COLOR", "MAIN"]);
  });

  it.each([
    ["missing vehicle", false, []],
    ["cross-vehicle image", true, ["image-1"]],
  ])("rejects a %s before invoking the mutation", async (_label, exists, missing) => {
    // Given
    vehicleExists = exists;
    missing.forEach((id) => missingImageIds.add(id));
    let invoked = false;

    // When
    const action = withLockedVehicleImages(request(["image-1"]), async () => { invoked = true; });

    // Then
    await expect(action).rejects.toBeInstanceOf(VehicleImageLockTargetError);
    expect(invoked).toBe(false);
  });

  it.each([
    ["P2034", { code: "P2034" }],
    ["postgres deadlock", { code: "P2010", meta: { code: "40P01" } }],
    ["postgres serialization", { code: "P2010", meta: { code: "40001" } }],
  ])("retries a bounded %s conflict and eventually succeeds", async (_label, failure) => {
    // Given
    failures.push(failure, failure);

    // When
    const result = await withLockedVehicleImages(request(), async () => "done");

    // Then
    expect(result).toBe("done");
    expect(attempts).toBe(3);
  });

  it.each([
    ["P2034", { code: "P2034" }],
    ["deadlock", { code: "P2010", meta: { code: "40P01" } }],
    ["serialization", { code: "P2010", meta: { code: "40001" } }],
  ])("maps repeated %s exhaustion to typed 409", async (_label, failure) => {
    // Given
    failures.push(failure, failure, failure);

    // When
    const action = withLockedVehicleImages(request(), async () => "never");

    // Then
    await expect(action).rejects.toEqual(expect.objectContaining({ code: "CONCURRENT_IMAGE_MUTATION", status: 409 }));
    await expect(action).rejects.toBeInstanceOf(ConcurrentImageMutationError);
    expect(attempts).toBe(3);
  });

  it("rethrows an unrelated Prisma failure without retrying", async () => {
    // Given
    const unrelated = { code: "P2002" };
    failures.push(unrelated);

    // When
    const action = withLockedVehicleImages(request(), async () => "never");

    // Then
    await expect(action).rejects.toBe(unrelated);
    expect(attempts).toBe(1);
  });

  it.each(["hide", "delete"])("blocks %s while representative selection owns the Vehicle lock", async (mutation) => {
    // Given
    const state: { id: string; isVisible: boolean; deletedAt: Date | null } = {
      id: "image-1",
      isVisible: true,
      deletedAt: null,
    };
    let representativeId: string | null = null;
    let enterSelection = (): void => undefined;
    const selectionEntered = new Promise<void>((resolve) => { enterSelection = resolve; });
    let finishSelection = (): void => undefined;
    const selectionGate = new Promise<void>((resolve) => { finishSelection = resolve; });
    const select = withLockedVehicleImages(request([state.id], ["MAIN"]), async () => {
      enterSelection();
      await selectionGate;
      representativeId = state.id;
      return "selected";
    });
    await selectionEntered;

    // When
    const compete = withLockedVehicleImages(request([state.id], ["MAIN"]), async () => mutation === "hide"
      ? setImageVisibility(state, false, representativeId)
      : softDeleteImage(state, representativeId, new Date()));
    finishSelection();

    // Then
    await expect(select).resolves.toBe("selected");
    await expect(compete).rejects.toEqual(expect.objectContaining({ code: "REPRESENTATIVE_IMAGE_MUTATION_FORBIDDEN" }));
  });

  it.each(["hide", "delete"])("makes representative selection reject when %s wins the Vehicle lock", async (mutation) => {
    // Given
    let state: { id: string; isVisible: boolean; deletedAt: Date | null } = {
      id: "image-1",
      isVisible: true,
      deletedAt: null,
    };
    let representativeId: string | null = null;
    const mutate = withLockedVehicleImages(request([state.id], ["MAIN"]), async () => {
      state = mutation === "hide"
        ? setImageVisibility(state, false, representativeId)
        : softDeleteImage(state, representativeId, new Date());
      return mutation;
    });

    // When
    const select = withLockedVehicleImages(request([state.id], ["MAIN"]), async () => {
      assertRepresentativeEligible(state);
      representativeId = state.id;
      return "selected";
    });

    // Then
    await expect(mutate).resolves.toBe(mutation);
    await expect(select).rejects.toEqual(expect.objectContaining({ code: "REPRESENTATIVE_IMAGE_INELIGIBLE" }));
    expect(representativeId).toBeNull();
  });
});
