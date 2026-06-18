/**
 * 대표 견적가 조회 헬퍼 (서버 전용).
 *
 * 차량 탐색·홈 인기차량·차량 상세가 동일하게 사용해 견적가 표기를 통일한다.
 *
 * 핵심: default 트림 하나에 의존하지 않는다.
 *   같은 차량에 가격이 다른 트림이 여러 개이고 일부 트림에만 회수율 시트가 붙은 경우가 있어
 *   (예: 싼 트림엔 시트 0개, 비싼 변형에만 시트 존재), 차량의 모든 노출 트림을 대상으로
 *   productType별 최저 견적("~부터")을 계산한 뒤 차량 단위로 병합한다.
 *   → 어떤 트림을 default로 잡든 결과가 동일해지고, 한 트림이라도 유효 견적이 있으면
 *     "견적 준비중"이 뜨지 않는다.
 */

import { prisma } from "@/lib/prisma";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import {
  calcRepresentativeQuotes,
  mergeLowestByProductType,
  type RepRateSheet,
  type RepresentativeQuote,
} from "@/lib/representative-quote";

export interface VehicleQuoteInput {
  /** 결과 Map의 key */
  vehicleId: string;
  vehicleSurchargeRate: number;
  trims: { trimId: string; vehiclePrice: number }[];
}

/**
 * 차량별 대표 견적가를 vehicleId → 견적 목록 Map으로 반환.
 * 유효 견적이 없는 차량은 Map에 포함되지 않는다(호출부에서 빈 배열로 처리).
 */
export async function getRepresentativeQuotesByVehicle(
  vehicles: VehicleQuoteInput[]
): Promise<Map<string, RepresentativeQuote[]>> {
  const result = new Map<string, RepresentativeQuote[]>();

  const trimIds = vehicles.flatMap((v) => v.trims.map((t) => t.trimId));
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

  for (const vehicle of vehicles) {
    // 모든 트림의 대표 견적가를 모은 뒤 productType별 최저값으로 병합
    const perTrimQuotes: RepresentativeQuote[] = vehicle.trims.flatMap((trim) => {
      const sheets = sheetsByTrim.get(trim.trimId);
      if (!sheets || sheets.length === 0) return [];
      return calcRepresentativeQuotes({
        vehiclePrice: trim.vehiclePrice,
        vehicleSurchargeRate: vehicle.vehicleSurchargeRate,
        rankSurchargeRates: rankRates,
        rateSheets: sheets,
      });
    });

    const merged = mergeLowestByProductType(perTrimQuotes);
    if (merged.length > 0) result.set(vehicle.vehicleId, merged);
  }

  return result;
}
