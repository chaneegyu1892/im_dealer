import { prisma } from "./prisma";

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
  recentLogs: any[];
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
    recentLogs: recentLogs.slice(0, 10),
  };
}

export async function getVehicleAiConfigs() {
  return prisma.recommendationConfig.findMany({
    include: {
      vehicle: {
        select: { id: true, name: true, brand: true, category: true },
      },
    },
  });
}
