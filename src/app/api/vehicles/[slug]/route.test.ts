import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeVehicle,
  type FindVehicleQuery,
  managedPrimaryCount,
  rateMatrix,
  serializeImages,
  serializeRepresentative,
} from "./route.test-fixtures";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findRateSheets: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: mocks.findUnique },
    capitalRateSheet: { findMany: mocks.findRateSheets },
  },
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ slug: "active-car" }) };
const request = new NextRequest("http://localhost/api/vehicles/active-car");

describe("GET /api/vehicles/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRateSheets.mockResolvedValue([]);
  });

  it("serializes the persisted representative for a visible vehicle", async () => {
    mocks.findUnique.mockResolvedValue(activeVehicle);

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        id: "vehicle-active",
        thumbnailUrl: "https://cdn.example/representative.jpg",
      },
    });
  });

  it("returns 404 for an unknown slug", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await GET(request, {
      params: Promise.resolve({ slug: "unknown-car" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "차량을 찾을 수 없습니다." });
  });

  it("returns 404 for a malformed blank slug without serializing vehicle data", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await GET(request, {
      params: Promise.resolve({ slug: " " }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "차량을 찾을 수 없습니다." });
  });

  it("serializes only active images in deterministic VehicleDetail order", async () => {
    mocks.findUnique.mockImplementation(async (query: FindVehicleQuery) => ({
      ...activeVehicle,
      images: serializeImages(query.include?.images),
    }));

    const first = await (await GET(request, context)).json();
    const second = await (await GET(request, context)).json();

    expect(first.data.images).toEqual([
      {
        id: "image-cover",
        type: "COVER",
        title: "커버",
        storageUrl: "https://cdn.example/cover.jpg",
        displayOrder: 0,
      },
      {
        id: "image-main",
        type: "MAIN",
        title: "메인",
        storageUrl: "https://cdn.example/main.jpg",
        displayOrder: 0,
      },
    ]);
    expect(second.data.images).toEqual(first.data.images);
  });

  it("keeps the persisted projection and active MAIN image when COVER is absent", async () => {
    mocks.findUnique.mockImplementation(async (query: FindVehicleQuery) => ({
      ...activeVehicle,
      images: serializeImages(query.include?.images).filter((image) => image.type === "MAIN"),
    }));

    const payload = await (await GET(request, context)).json();

    expect(payload.data.thumbnailUrl).toBe("https://cdn.example/representative.jpg");
    expect(payload.data.images).toEqual([{
      id: "image-main",
      type: "MAIN",
      title: "메인",
      storageUrl: "https://cdn.example/main.jpg",
      displayOrder: 0,
    }]);
  });

  it("keeps malformed legacy rate matrices on the prior zero-rate response path", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeVehicle,
      images: [],
      trims: [{
        id: "trim-default",
        name: "기본 트림",
        price: 40_000_000,
        engineType: "GASOLINE",
        fuelEfficiency: null,
        isDefault: true,
        specs: null,
        options: [],
      }],
    });
    mocks.findRateSheets.mockResolvedValue([{
      financeCompanyId: "finance-1",
      minVehiclePrice: 30_000_000,
      maxVehiclePrice: 50_000_000,
      minRateMatrix: "legacy-malformed",
      maxRateMatrix: ["legacy-malformed"],
      depositDiscountRate: -0.000523,
      prepayAdjustRate: 0.000073,
      financeCompany: {
        name: "테스트캐피탈",
        surchargeRate: 0,
      },
    }]);

    const response = await GET(request, context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.scenarios).toMatchObject({
      conservative: { monthlyPayment: -41_840 },
      standard: { monthlyPayment: 0 },
      aggressive: { monthlyPayment: -241_240 },
    });
    expect(payload.data.hasRateConfig).toBe(true);
  });

  it("preserves the original first-zero later-positive finance selection", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeVehicle,
      images: [],
      trims: [{
        id: "trim-default",
        name: "기본 트림",
        price: 40_000_000,
        engineType: "GASOLINE",
        fuelEfficiency: null,
        isDefault: true,
        specs: null,
        options: [],
      }],
    });
    mocks.findRateSheets.mockResolvedValue([
      {
        financeCompanyId: "finance-zero",
        minVehiclePrice: 30_000_000,
        maxVehiclePrice: 50_000_000,
        minRateMatrix: rateMatrix(0),
        maxRateMatrix: rateMatrix(0),
        depositDiscountRate: -0.000523,
        prepayAdjustRate: 0.000073,
        financeCompany: { name: "제로캐피탈", surchargeRate: 0 },
      },
      {
        financeCompanyId: "finance-positive",
        minVehiclePrice: 30_000_000,
        maxVehiclePrice: 50_000_000,
        minRateMatrix: rateMatrix(0.02),
        maxRateMatrix: rateMatrix(0.02),
        depositDiscountRate: -0.000523,
        prepayAdjustRate: 0.000073,
        financeCompany: { name: "포지티브캐피탈", surchargeRate: 0 },
      },
    ]);

    const payload = await (await GET(request, context)).json();

    expect(payload.data.bestFinanceName).toBe("포지티브캐피탈");
    expect(payload.data.scenarios.standard.monthlyPayment).toBe(800_000);
  });

  it("allows raw legacy gallery fallback only for an unmigrated vehicle", async () => {
    mocks.findUnique.mockImplementation(async (query: FindVehicleQuery) => ({
      ...activeVehicle,
      images: [],
      _count: { images: managedPrimaryCount(query, 0) },
    }));

    const payload = await (await GET(request, context)).json();

    expect(payload.data.legacyImageFallbackAllowed).toBe(true);
    expect(payload.data.heroImageProjectionAllowed).toBe(true);
    expect(payload.data.imageUrls).toEqual(["https://cdn.example/legacy.jpg"]);
  });

  it("denies raw legacy fallback when managed primary rows are hidden or deleted", async () => {
    mocks.findUnique.mockImplementation(async (query: FindVehicleQuery) => ({
      ...activeVehicle,
      images: [{
        id: "image-hidden",
        type: "COVER",
        title: "숨김 표지",
        sourceUrl: activeVehicle.thumbnailUrl,
        storageUrl: "https://cdn.example/mirrored-hidden.jpg",
        displayOrder: 0,
        isVisible: false,
        deletedAt: null,
      }],
      _count: { images: managedPrimaryCount(query, 2) },
    }));

    const payload = await (await GET(request, context)).json();

    expect(payload.data.images).toEqual([]);
    expect(payload.data.imageUrls).toEqual([]);
    expect(payload.data.thumbnailUrl).toBe("");
    expect(payload.data.legacyImageFallbackAllowed).toBe(false);
    expect(payload.data.heroImageProjectionAllowed).toBe(false);
  });

  it("allows the thumbnail projection only for an active linked representative", async () => {
    mocks.findUnique.mockImplementation(async (query: FindVehicleQuery) => ({
      ...activeVehicle,
      thumbnailImageId: "representative-image",
      thumbnailImage: serializeRepresentative(query, {
        vehicleId: activeVehicle.id,
        isVisible: true,
        deletedAt: null,
        storageUrl: "https://cdn.example/representative.jpg",
      }),
      _count: { images: managedPrimaryCount(query, 1) },
    }));

    const payload = await (await GET(request, context)).json();

    expect(payload.data.heroImageProjectionAllowed).toBe(true);
    expect(payload.data.thumbnailUrl).toBe("https://cdn.example/representative.jpg");
    expect(payload.data).not.toHaveProperty("thumbnailImage");
    expect(payload.data).not.toHaveProperty("_count");
  });

});
