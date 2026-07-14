import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import { prisma } from "@/lib/prisma";
import type { OperationalVehicleSnapshot } from "./operational-eligibility";
import {
  canUseLegacyImageFallback,
  publicThumbnailProjectionInclude,
  resolvePublicThumbnailUrl,
} from "@/lib/vehicle-images/public";

export interface OverlapRuntimePopularConfig {
  readonly id: string;
  readonly name: string;
  readonly note: string | null;
  readonly items: readonly {
    readonly id: string;
    readonly name: string;
    readonly price: number;
    readonly trimOptionId: string | null;
  }[];
}

export interface OverlapRuntimeVehicle extends OperationalVehicleSnapshot {
  readonly surchargeRate: number;
  readonly isPopular: boolean;
  readonly thumbnailUrl: string;
  readonly imageUrls: readonly string[];
  readonly highlights: readonly string[];
  readonly popularConfigs: readonly OverlapRuntimePopularConfig[];
}

export interface OverlapCandidateSnapshot {
  readonly vehicles: readonly OverlapRuntimeVehicle[];
  readonly rankSurchargeRates: readonly number[];
}

export async function loadOverlapCandidateSnapshot(): Promise<OverlapCandidateSnapshot> {
  const [vehicles, rankSurcharges] = await Promise.all([
    prisma.vehicle.findMany({
      include: {
        recConfigs: true,
        trims: {
          include: {
            lineup: { select: { name: true, isVisible: true } },
            rateSheets: { include: { financeCompany: true } },
          },
        },
        popularConfigs: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          include: { items: { orderBy: { displayOrder: "asc" } } },
        },
        ...publicThumbnailProjectionInclude,
      },
    }),
    prisma.rankSurchargeConfig.findMany({ orderBy: { rank: "asc" } }),
  ]);

  return {
    rankSurchargeRates: rankSurcharges.length > 0
      ? rankSurcharges.map((row) => row.rate)
      : [...RANK_SURCHARGE_RATES],
    vehicles: vehicles.map((vehicle) => ({
      vehicleId: vehicle.id,
      slug: vehicle.slug,
      brand: vehicle.brand,
      name: vehicle.name,
      category: vehicle.category,
      isVisible: vehicle.isVisible,
      surchargeRate: vehicle.surchargeRate,
      isPopular: vehicle.isPopular,
      thumbnailUrl: resolvePublicThumbnailUrl(vehicle),
      imageUrls: canUseLegacyImageFallback(vehicle) ? vehicle.imageUrls : [],
      highlights: vehicle.recConfigs?.highlights ?? [],
      config: vehicle.recConfigs ? {
        isActive: vehicle.recConfigs.isActive,
        profile: vehicle.recConfigs.scoreMatrix,
      } : null,
      trims: vehicle.trims.map((trim) => ({
        id: trim.id,
        name: trim.name,
        price: trim.price,
        discountPrice: trim.discountPrice,
        isDefault: trim.isDefault,
        isVisible: trim.isVisible,
        lineup: trim.lineup,
        rateSheets: trim.rateSheets.map((sheet) => ({
          id: sheet.id,
          productType: sheet.productType,
          isActive: sheet.isActive,
          minVehiclePrice: sheet.minVehiclePrice,
          maxVehiclePrice: sheet.maxVehiclePrice,
          minRateMatrix: sheet.minRateMatrix,
          maxRateMatrix: sheet.maxRateMatrix,
          depositDiscountRate: sheet.depositDiscountRate,
          prepayAdjustRate: sheet.prepayAdjustRate,
          financeCompany: {
            id: sheet.financeCompany.id,
            name: sheet.financeCompany.name,
            isActive: sheet.financeCompany.isActive,
            surchargeRate: sheet.financeCompany.surchargeRate,
          },
        })),
      })),
      popularConfigs: vehicle.popularConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        note: config.note,
        items: config.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          trimOptionId: item.trimOptionId,
        })),
      })),
    })),
  };
}
