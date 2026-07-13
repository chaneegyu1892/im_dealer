import { PrismaClient, type Brand, type Vehicle } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { applyExistingVehiclesToPrisma } from "./prisma-apply";
import type { CrawlVehicleSnapshot } from "./types";

const now = new Date("2026-07-13T00:00:00.000Z");
const crawlVehicle: CrawlVehicleSnapshot = {
  modelId: "model-1", brandName: "기아", modelName: "쏘렌토", cartypeCode: "R5",
  engineCode: "G", state: "2", summary: "새 설명", priceMin: 40_000_000,
  imageLarge: "https://carpan.example/main.webp", cover: "https://carpan.example/cover.webp",
  catalogFileCount: 0, priceFileCount: 0, catalogFiles: [], priceFiles: [], options: [],
  exteriorColors: [], interiorColors: [], lineups: [], trims: [],
};

const vehicleRow: Vehicle = {
  id: "vehicle-1", slug: "sorento", name: "기존 쏘렌토", brand: "기아", category: "SUV",
  vehicleCode: null, externalId: "model-1", externalSource: "carpan2", basePrice: 39_000_000,
  thumbnailUrl: "/admin.webp", imageUrls: ["/legacy.webp"], thumbnailImageId: "admin-image",
  imageRevision: 0,
  surchargeRate: 0, isVisible: true, isPopular: false, isSpotlight: false,
  slidingDoorOverride: null, advancedSafetyOverride: null, displayOrder: 0, description: null,
  tags: [], detailedSpecs: null, createdAt: now, updatedAt: now,
};

const brandRow: Brand = {
  id: "brand-1", name: "기아", logoUrl: null, displayOrder: 0, isFeatured: true,
  createdAt: now, updatedAt: now,
};

describe("applyExistingVehiclesToPrisma", () => {
  it("existing vehicle sync가 representative projection 필드를 쓰지 않는다", async () => {
    const prisma = new PrismaClient();
    const tx = new PrismaClient();
    vi.spyOn(prisma.vehicle, "findMany").mockResolvedValue([vehicleRow]);
    vi.spyOn(tx.brand, "upsert").mockResolvedValue(brandRow);
    const update = vi.spyOn(tx.vehicle, "update").mockResolvedValue(vehicleRow);

    const stats = await applyExistingVehiclesToPrisma({
      prisma,
      crawlVehicles: [crawlVehicle],
      transactionRunner: (mutation) => mutation(tx),
    });

    expect(stats.vehiclesUpdated).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "vehicle-1" },
      data: {
        name: "쏘렌토", brand: "기아", category: "SUV", externalSource: "carpan2",
        basePrice: 40_000_000, description: "새 설명",
      },
    });
    const data = update.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty("thumbnailUrl");
    expect(data).not.toHaveProperty("thumbnailImageId");
    expect(data).not.toHaveProperty("imageUrls");
    await Promise.all([prisma.$disconnect(), tx.$disconnect()]);
  });
});
