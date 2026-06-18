/**
 * 대표 견적가 조회 헬퍼 (서버 전용).
 *
 * 차량 탐색·홈 인기차량 목록은 여러 차량의 defaultTrim에 대해 대표 견적가가 필요하다.
 * 이 함수가 회수율 시트와 순위 가산율을 한 번에 조회해 trimId별 대표 견적가 Map을 반환한다.
 * (목록 빌더마다 중복되던 회수율 조회 로직을 단일화 — 견적가 불일치 방지)
 */

import { prisma } from "@/lib/prisma";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import {
  calcRepresentativeQuotes,
  type RepRateSheet,
  type RepresentativeQuote,
} from "@/lib/representative-quote";

export interface TrimQuoteInput {
  trimId: string;
  vehiclePrice: number;
  vehicleSurchargeRate: number;
}

/**
 * 트림들의 대표 견적가를 trimId별 Map으로 반환.
 * 견적 산출이 불가능한 트림은 Map에 포함되지 않는다(호출부에서 빈 배열로 처리).
 */
export async function getRepresentativeQuotesByTrim(
  trims: TrimQuoteInput[]
): Promise<Map<string, RepresentativeQuote[]>> {
  const result = new Map<string, RepresentativeQuote[]>();
  const trimIds = trims.map((t) => t.trimId);
  if (trimIds.length === 0) return result;

  const [rateSheets, rankSurcharges] = await Promise.all([
    (prisma as any).capitalRateSheet.findMany({
      where: {
        trimId: { in: trimIds },
        isActive: true,
        financeCompany: { isActive: true },
      },
      include: { financeCompany: true },
    }),
    prisma.rankSurchargeConfig.findMany({ orderBy: { rank: "asc" } }),
  ]);

  const rankRates =
    rankSurcharges.length > 0
      ? rankSurcharges.map((r) => r.rate)
      : [...RANK_SURCHARGE_RATES];

  // trimId → 시트 목록
  const sheetsByTrim = new Map<string, RepRateSheet[]>();
  for (const rs of rateSheets as any[]) {
    const sheet: RepRateSheet = {
      productType: rs.productType,
      financeCompanyId: rs.financeCompanyId,
      financeCompanyName: rs.financeCompany.name,
      financeSurchargeRate: rs.financeCompany.surchargeRate,
      minVehiclePrice: rs.minVehiclePrice,
      maxVehiclePrice: rs.maxVehiclePrice,
      minRateMatrix: rs.minRateMatrix,
      maxRateMatrix: rs.maxRateMatrix,
      depositDiscountRate: rs.depositDiscountRate,
      prepayAdjustRate: rs.prepayAdjustRate,
    };
    const existing = sheetsByTrim.get(rs.trimId) ?? [];
    sheetsByTrim.set(rs.trimId, [...existing, sheet]);
  }

  for (const trim of trims) {
    const sheets = sheetsByTrim.get(trim.trimId);
    if (!sheets || sheets.length === 0) continue;
    const quotes = calcRepresentativeQuotes({
      vehiclePrice: trim.vehiclePrice,
      vehicleSurchargeRate: trim.vehicleSurchargeRate,
      rankSurchargeRates: rankRates,
      rateSheets: sheets,
    });
    if (quotes.length > 0) result.set(trim.trimId, quotes);
  }

  return result;
}
