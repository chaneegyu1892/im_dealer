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
  tags: [], detailedSpecs: null, scraperRefs: null, createdAt: now, updatedAt: now,
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

  it("Carpan2 state=2/3을 신규·기존 트림 노출 상태에 동일하게 반영한다", async () => {
    const prisma = new PrismaClient();
    const tx = new PrismaClient();
    vi.spyOn(prisma.vehicle, "findMany").mockResolvedValue([vehicleRow]);
    vi.spyOn(tx.brand, "upsert").mockResolvedValue(brandRow);
    vi.spyOn(tx.vehicle, "update").mockResolvedValue(vehicleRow);
    vi.spyOn(tx.vehicleLineup, "upsert").mockResolvedValue({ id: "lineup-1" } as never);
    const trimUpsert = vi.spyOn(tx.trim, "upsert")
      .mockResolvedValueOnce({ id: "trim-sold" } as never)
      .mockResolvedValueOnce({ id: "trim-ended" } as never);

    const vehicleWithTrims: CrawlVehicleSnapshot = {
      ...crawlVehicle,
      lineups: [{ lineupId: "lineup-1", name: "2027년형", year: "2027", state: "2" }],
      trims: [
        {
          trimId: "trim-sold", lineupId: "lineup-1", name: "판매 중", price: 40_000_000,
          state: "2", engineCode: "G", displace: null, person: null, carry: null, options: [],
        },
        {
          trimId: "trim-ended", lineupId: "lineup-1", name: "판매 종료", price: 41_000_000,
          state: "3", engineCode: "G", displace: null, person: null, carry: null, options: [],
        },
      ],
    };

    await applyExistingVehiclesToPrisma({
      prisma,
      crawlVehicles: [vehicleWithTrims],
      transactionRunner: (mutation) => mutation(tx),
    });

    expect(trimUpsert.mock.calls[0]?.[0]).toMatchObject({
      create: { isVisible: true },
      update: {
        isVisible: true,
        detailedSpecs: { externalRaw: { state: "2" } },
      },
    });
    expect(trimUpsert.mock.calls[1]?.[0]).toMatchObject({
      create: { isVisible: false },
      update: {
        isVisible: false,
        detailedSpecs: { externalRaw: { state: "3" } },
      },
    });
    await Promise.all([prisma.$disconnect(), tx.$disconnect()]);
  });
});
