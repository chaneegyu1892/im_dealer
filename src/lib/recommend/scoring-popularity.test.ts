import { describe, expect, it } from "vitest";
import { scoreVehicle } from "./scoring";
import type { VehicleAttrs } from "./vehicle-attributes";

const ATTRS: VehicleAttrs = {
  isAwd: false,
  cargoKg: null,
  isRefrigerated: false,
  seating: 5,
  fuel: "가솔린",
  hasSlidingDoor: false,
  hasAdvancedSafety: false,
  isPopular: false,
};

describe("legacy recommendation popularity separation", () => {
  it("does not change score or reasons from Vehicle.isPopular", () => {
    const input = {
      industry: "개인",
      preferences: [],
      annualMileage: 20_000,
    };
    const context = {
      category: "세단",
      price: 35_000_000,
      fuelEfficiency: 10,
    };

    expect(scoreVehicle(input, { ...ATTRS, isPopular: true }, context)).toEqual(
      scoreVehicle(input, ATTRS, context)
    );
  });
});
