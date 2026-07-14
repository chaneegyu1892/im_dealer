import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const prismaMock = vi.hoisted(() => ({
  vehicle: { findUnique: vi.fn() },
  trim: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

function trim({
  id,
  lineupName,
  lineupVisible,
  products = [],
}: {
  id: string;
  lineupName: string;
  lineupVisible: boolean;
  products?: string[];
}) {
  return {
    id,
    name: `${lineupName} 프리미엄`,
    price: 40_000_000,
    discountPrice: null,
    evSubsidy: null,
    engineType: "GASOLINE",
    fuelEfficiency: 10,
    isDefault: false,
    isVisible: true,
    specs: null,
    options: [],
    rules: [],
    lineupId: `lineup-${id}`,
    lineup: {
      id: `lineup-${id}`,
      name: lineupName,
      isVisible: lineupVisible,
    },
    rateSheets: products.map((productType) => ({ productType })),
  };
}

describe("GET /api/vehicles/[slug]/trims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "vehicle-1", name: "테스트 차량" });
  });

  it("preserves normal lineup visibility and exposes quote availability per trim", async () => {
    prismaMock.trim.findMany.mockResolvedValue([
      trim({ id: "visible", lineupName: "2026년형 가솔린", lineupVisible: true, products: ["장기렌트"] }),
      trim({ id: "hidden", lineupName: "2026년형 하이브리드", lineupVisible: false, products: ["리스"] }),
    ]);

    const response = await GET(
      new NextRequest("https://example.com/api/vehicles/test-car/trims"),
      { params: Promise.resolve({ slug: "test-car" }) }
    );
    const payload = await response.json();

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      id: "visible",
      availableProducts: ["장기렌트"],
    });
  });

  it("does not resurrect trims from lineups explicitly hidden by an operator", async () => {
    prismaMock.trim.findMany.mockResolvedValue([
      trim({ id: "old", lineupName: "2025년형 가솔린", lineupVisible: false }),
      trim({ id: "latest", lineupName: "2026년형 가솔린", lineupVisible: false }),
    ]);

    const response = await GET(
      new NextRequest("https://example.com/api/vehicles/test-car/trims"),
      { params: Promise.resolve({ slug: "test-car" }) }
    );
    const payload = await response.json();

    expect(payload.data).toEqual([]);
  });

  it("returns the latest visible lineup and ignores a hidden older lineup", async () => {
    prismaMock.trim.findMany.mockResolvedValue([
      trim({ id: "old", lineupName: "2025년형 가솔린", lineupVisible: false }),
      trim({ id: "latest", lineupName: "2027년형 가솔린", lineupVisible: true }),
    ]);

    const response = await GET(
      new NextRequest("https://example.com/api/vehicles/test-car/trims"),
      { params: Promise.resolve({ slug: "test-car" }) }
    );
    const payload = await response.json();

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      id: "latest",
      lineup: { name: "2027년형 가솔린" },
    });
  });
});
