import { prisma } from "./prisma";
import { getRecommendationExclusion } from "./recommend/excluded-vehicles";
import { assessOperationalEligibility } from "./recommend/operational-eligibility";
import { parseOverlapProfile } from "./recommend/overlap-profile";
import type { VehicleAiConfigDto } from "@/types/admin-ai";

export interface AiRecentLogDto {
  readonly id: string;
  readonly industry: string;
  readonly purpose: string;
  readonly recommendationCount: number;
  readonly clickedVehicleId: string | null;
  readonly createdAt: string;
}

export interface AiInsightData {
  totalRecommendations: number;
  popularPersonas: {
    industry: string;
    purpose: string;
    count: number;
  }[];
  topRecommendedVehicles: {
    vehicleId: string;
    name: string;
    brand: string;
    recommendCount: number;
    clickCount: number;
    ctr: number;
  }[];
  recentLogs: AiRecentLogDto[];
}

export async function getAiInsights(): Promise<AiInsightData> {
  // 1) 전체 추천 수
  const totalRecommendations = await prisma.recommendationLog.count();

  // 2) 인기 페르소나 (업종 + 목적 조합)
  const personas = await prisma.recommendationLog.groupBy({
    by: ["industry", "purpose"],
    _count: { _all: true },
    orderBy: { _count: { industry: "desc" } },
    take: 10,
  });

  // 3) 최다 추천 차량 & 클릭률
  // Note: recommendedVehicleIds는 배열이므로 원시 쿼리가 필요할 수 있지만, 
  // 여기서는 단순히 clickedVehicleId 빈도와 전체 로그 기반으로 합산 처리 (간략화)
  const clicks = await prisma.recommendationLog.groupBy({
    by: ["clickedVehicleId"],
    where: { clickedVehicleId: { not: null } },
    _count: { _all: true },
  });

  const clickMap = new Map(clicks.map((c) => [c.clickedVehicleId, c._count._all]));

  // 추천된 차량 빈도 계산 (최근 200개 로그 기반 샘플링)
  const recentLogs = await prisma.recommendationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      industry: true,
      purpose: true,
      recommendedVehicleIds: true,
      clickedVehicleId: true,
      createdAt: true,
    },
  });

  const recommendationCounts = new Map<string, number>();
  recentLogs.forEach((log) => {
    log.recommendedVehicleIds.forEach((vid) => {
      recommendationCounts.set(vid, (recommendationCounts.get(vid) || 0) + 1);
    });
  });

  // 추천 빈도 상위 차량 ID들 추출
  const topVehicleIds = Array.from(recommendationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  // 상위 차량들의 실제 정보 조회
  const vehicleInfos = await prisma.vehicle.findMany({
    where: { id: { in: topVehicleIds } },
    select: { id: true, name: true, brand: true },
  });

  const topVehicles = vehicleInfos.map((v) => {
    const recommendCount = recommendationCounts.get(v.id) || 0;
    const clickCount = clickMap.get(v.id) || 0;
    return {
      vehicleId: v.id,
      name: v.name,
      brand: v.brand,
      recommendCount,
      clickCount,
      ctr: recommendCount > 0 ? (clickCount / recommendCount) * 100 : 0,
    };
  }).sort((a, b) => b.recommendCount - a.recommendCount);

  return {
    totalRecommendations,
    popularPersonas: personas.map((p) => ({
      industry: p.industry,
      purpose: p.purpose,
      count: p._count._all,
    })),
    topRecommendedVehicles: topVehicles,
    recentLogs: recentLogs.slice(0, 10).map((log) => ({
      id: log.id,
      industry: log.industry,
      purpose: log.purpose,
      recommendationCount: log.recommendedVehicleIds.length,
      clickedVehicleId: log.clickedVehicleId,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getVehicleAiConfigs(): Promise<VehicleAiConfigDto[]> {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ brand: "asc" }, { name: "asc" }],
    include: {
      recConfigs: true,
      trims: {
        include: {
          lineup: { select: { name: true, isVisible: true } },
          rateSheets: { include: { financeCompany: true } },
        },
      },
    },
  });
  return vehicles.map((vehicle) => {
    const snapshot = {
      vehicleId: vehicle.id,
      slug: vehicle.slug,
      brand: vehicle.brand,
      name: vehicle.name,
      category: vehicle.category,
      isVisible: vehicle.isVisible,
      config: vehicle.recConfigs ? { isActive: vehicle.recConfigs.isActive, profile: vehicle.recConfigs.scoreMatrix } : null,
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
    };
    const parsed = vehicle.recConfigs ? parseOverlapProfile(vehicle.recConfigs.scoreMatrix) : null;
    const profileState = parsed === null ? "missing" : parsed.kind;
    return {
      vehicle: {
        id: vehicle.id,
        slug: vehicle.slug,
        name: vehicle.name,
        brand: vehicle.brand,
        category: vehicle.category,
        isVisible: vehicle.isVisible,
      },
      config: vehicle.recConfigs ? {
        id: vehicle.recConfigs.id,
        profile: vehicle.recConfigs.scoreMatrix,
        isActive: vehicle.recConfigs.isActive,
        highlights: vehicle.recConfigs.highlights,
        aiCaption: vehicle.recConfigs.aiCaption,
        updatedAt: vehicle.recConfigs.updatedAt.toISOString(),
      } : null,
      profileState,
      fuelGroup: parsed?.kind === "valid" ? parsed.profile.fuelGroup : null,
      exclusion: getRecommendationExclusion(vehicle),
      coverage: {
        "10000": assessOperationalEligibility(snapshot, 10_000).status,
        "20000": assessOperationalEligibility(snapshot, 20_000).status,
        "30000": assessOperationalEligibility(snapshot, 30_000).status,
      },
    };
  });
}
