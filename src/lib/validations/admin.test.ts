import { describe, it, expect } from "vitest";
import {
  inventoryCreateSchema,
  inventoryUpdateSchema,
  aiConfigUpdateSchema,
  popularConfigCreateSchema,
} from "./admin";

describe("inventoryCreateSchema", () => {
  const valid = {
    vehicleSlug: "kia-ev9",
    trimName: "Earth",
    stockCount: 3,
    immediateDelivery: true,
  };

  it("accepts a valid payload", () => {
    expect(inventoryCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(inventoryCreateSchema.safeParse({}).success).toBe(false);
    expect(
      inventoryCreateSchema.safeParse({ ...valid, vehicleSlug: "" }).success
    ).toBe(false);
  });

  it("rejects negative or oversized stockCount", () => {
    expect(
      inventoryCreateSchema.safeParse({ ...valid, stockCount: -1 }).success
    ).toBe(false);
    expect(
      inventoryCreateSchema.safeParse({ ...valid, stockCount: 100000 }).success
    ).toBe(false);
  });

  it("rejects non-integer stockCount", () => {
    expect(
      inventoryCreateSchema.safeParse({ ...valid, stockCount: 1.5 }).success
    ).toBe(false);
  });

  it("caps selectedOptions length", () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `opt-${i}`);
    expect(
      inventoryCreateSchema.safeParse({ ...valid, selectedOptions: tooMany })
        .success
    ).toBe(false);
  });

  it("defaults immediateDelivery to false and selectedOptions to []", () => {
    const parsed = inventoryCreateSchema.parse({
      vehicleSlug: "x",
      trimName: "y",
      stockCount: 0,
    });
    expect(parsed.immediateDelivery).toBe(false);
    expect(parsed.selectedOptions).toEqual([]);
  });
});

describe("inventoryUpdateSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(inventoryUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts ISO datetime for expectedUpdatedAt", () => {
    expect(
      inventoryUpdateSchema.safeParse({
        expectedUpdatedAt: "2026-05-01T12:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects non-ISO string for expectedUpdatedAt", () => {
    expect(
      inventoryUpdateSchema.safeParse({ expectedUpdatedAt: "yesterday" })
        .success
    ).toBe(false);
  });
});

describe("aiConfigUpdateSchema", () => {
  it("accepts valid scoreMatrix in 0..1 range", () => {
    const parsed = aiConfigUpdateSchema.safeParse({
      id: "cfg1",
      scoreMatrix: { fuel: { gasoline: 0.7, ev: 0.9 } },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects scoreMatrix values outside 0..1", () => {
    expect(
      aiConfigUpdateSchema.safeParse({
        id: "cfg1",
        scoreMatrix: { fuel: { gasoline: 1.5 } },
      }).success
    ).toBe(false);
    expect(
      aiConfigUpdateSchema.safeParse({
        id: "cfg1",
        scoreMatrix: { fuel: { gasoline: -0.1 } },
      }).success
    ).toBe(false);
  });

  it("requires id", () => {
    expect(
      aiConfigUpdateSchema.safeParse({ aiCaption: "hello" }).success
    ).toBe(false);
  });

  it("rejects oversized highlights array", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `h${i}`);
    expect(
      aiConfigUpdateSchema.safeParse({ id: "cfg1", highlights: tooMany }).success
    ).toBe(false);
  });
});

describe("popularConfigCreateSchema", () => {
  it("accepts a valid config", () => {
    const result = popularConfigCreateSchema.safeParse({
      name: "기본 구성",
      items: [
        { name: "썬루프", price: 1000000, displayOrder: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative price", () => {
    const result = popularConfigCreateSchema.safeParse({
      name: "x",
      items: [{ name: "i", price: -1, displayOrder: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(popularConfigCreateSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
