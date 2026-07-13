import { describe, expect, it } from "vitest";
import {
  IMAGE_GROUP_TYPES,
  VehicleImageGroupPolicyError,
  applyCompleteGroupOrder,
  getVehicleImageGroup,
  planImageTypeMove,
} from "./groups";

const active = (id: string, type: "MAIN" | "COVER" | "EXTERIOR_COLOR", displayOrder: number, vehicleId = "vehicle-1", createdAt = new Date("2026-07-12T00:00:00Z")) => ({
  id,
  vehicleId,
  type,
  displayOrder,
  createdAt,
  deletedAt: null,
});

describe("canonical vehicle image groups", () => {
  it("maps PRIMARY to MAIN/COVER and every remaining type to one exact group", () => {
    // Given / When / Then
    expect(IMAGE_GROUP_TYPES).toEqual({
      PRIMARY: ["MAIN", "COVER"],
      EXTERIOR_COLOR: ["EXTERIOR_COLOR"],
      INTERIOR_COLOR: ["INTERIOR_COLOR"],
      SPEC_EXTERIOR: ["SPEC_EXTERIOR"],
      SPEC_INTERIOR: ["SPEC_INTERIOR"],
      SPEC_SEAT: ["SPEC_SEAT"],
      SPEC_OPTION: ["SPEC_OPTION"],
      CATALOG_PAGE: ["CATALOG_PAGE"],
    });
    expect(getVehicleImageGroup("MAIN")).toBe("PRIMARY");
    expect(getVehicleImageGroup("COVER")).toBe("PRIMARY");
    expect(getVehicleImageGroup("SPEC_OPTION")).toBe("SPEC_OPTION");
  });

  it("assigns 0-based order when payload is the complete active group set", () => {
    // Given
    const rows = [active("cover", "COVER", 8), active("main", "MAIN", 3)];

    // When
    const result = applyCompleteGroupOrder("vehicle-1", "PRIMARY", ["main", "cover"], rows);

    // Then
    expect(result).toEqual([
      { id: "main", displayOrder: 0 },
      { id: "cover", displayOrder: 1 },
    ]);
  });

  it.each([
    ["incomplete", ["main"], [active("main", "MAIN", 0), active("cover", "COVER", 1)]],
    ["cross-group", ["main", "color"], [active("main", "MAIN", 0), active("color", "EXTERIOR_COLOR", 0)]],
    ["cross-vehicle", ["main"], [active("main", "MAIN", 0, "vehicle-2")]],
  ])("rejects a %s reorder against mutation-time DB membership", (_label, ids, rows) => {
    // Given / When
    const action = () => applyCompleteGroupOrder("vehicle-1", "PRIMARY", ids, rows);

    // Then
    expect(action).toThrow(VehicleImageGroupPolicyError);
  });

  it("retains order for a type edit inside PRIMARY", () => {
    // Given
    const rows = [active("main", "MAIN", 4), active("cover", "COVER", 7)];

    // When
    const result = planImageTypeMove("vehicle-1", "main", "COVER", rows);

    // Then
    expect(result).toEqual([{ id: "main", type: "COVER", displayOrder: 4 }]);
  });

  it("removes, appends, and normalizes both groups for a cross-group edit", () => {
    // Given
    const rows = [active("main", "MAIN", 2), active("cover", "COVER", 9), active("color", "EXTERIOR_COLOR", 4)];

    // When
    const result = planImageTypeMove("vehicle-1", "main", "EXTERIOR_COLOR", rows);

    // Then
    expect(result).toEqual([
      { id: "cover", displayOrder: 0 },
      { id: "color", displayOrder: 0 },
      { id: "main", type: "EXTERIOR_COLOR", displayOrder: 1 },
    ]);
  });

  it("uses createdAt before id when legacy rows have tied display order", () => {
    // Given
    const rows = [
      active("older-id-sort-later", "COVER", 0, "vehicle-1", new Date("2026-07-11T00:00:00Z")),
      active("newer-id-sort-first", "COVER", 0, "vehicle-1", new Date("2026-07-12T00:00:00Z")),
      active("main", "MAIN", 0),
      active("color", "EXTERIOR_COLOR", 0),
    ];

    // When
    const result = planImageTypeMove("vehicle-1", "main", "EXTERIOR_COLOR", rows);

    // Then
    expect(result.slice(0, 2)).toEqual([
      { id: "older-id-sort-later", displayOrder: 0 },
      { id: "newer-id-sort-first", displayOrder: 1 },
    ]);
  });
});
