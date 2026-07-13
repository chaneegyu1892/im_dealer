/**
 * AI 추천 엔진 — 회수율 기반 견적 + 규칙 기반 스코어링 (예산 제거 버전)
 *
 * 1) 노출 가능 차량 조회
 * 2) vehicleCode로 RateConfig 매핑 → 최저가 금융사 견적 산출 (결과 표시용 bestMonthly)
 * 3) 차량 카테고리 × 업종·목적 가중치 → 상위 3개 추천 (예산 비교·필터 없음)
 * 4) 3개 시나리오(무보증/보증금/선납금) 계산
 */

import { prisma } from "@/lib/prisma";
import { buildVehicleAttrs } from "@/lib/recommend/vehicle-attributes";
import { scoreVehicle } from "@/lib/recommend/scoring";
import {
  getRecommendationModelKey,
  getRecommendationModelYear,
  latestByRecommendationModel,
  pickRecommendationTrim,
} from "@/lib/recommend/latest-model";
import { parseRateSheetRaw } from "@/lib/recommend/rate-sheet";
import {
  estimateMonthly,
  type RateConfigData,
} from "@/lib/quote-calculator";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import { PREFERENCE_OPTIONS } from "@/constants/recommend-options";
import type {
  RecommendInput,
  RecommendedVehicle,
} from "@/types/recommendation";
import {
  canUseLegacyImageFallback,
  publicThumbnailProjectionInclude,
  resolvePublicThumbnailUrl,
} from "@/lib/vehicle-images/public";
import { buildRecommendScenarios } from "./recommend-scenarios";
import { readLegacyScoreMatrixBonus } from "./recommend-legacy-score-matrix";
import {
  finalizeLegacyRecommendations,
  type LegacyScoredVehicle,
} from "./recommend-legacy-results";

export async function recommendLegacyV1(input: RecommendInput): Promise<RecommendedVehicle[]> {
  // 1) 노출 가능 차량 + 추천설정 조회
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: { isDefault: "desc" },
        include: {
          options: { select: { name: true } },
          lineup: { select: { name: true, isVisible: true } },
        },
      },
      recConfigs: { where: { isActive: true } },
      popularConfigs: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        include: { items: { orderBy: { displayOrder: "asc" } } },
      },
      ...publicThumbnailProjectionInclude,
    },
  });

  // 2) 활성 capitalRateSheet 전체 조회 (trimId → RateConfigData[] 맵)
  const allSheets = await prisma.capitalRateSheet.findMany({
    where: { isActive: true, financeCompany: { isActive: true } },
    include: { financeCompany: true },
  });

  // 순위 가산율 조회
  const rankSurcharges = await prisma.rankSurchargeConfig.findMany({
    orderBy: { rank: "asc" },
  });
  const rankRates = rankSurcharges.length > 0
    ? rankSurcharges.map((r) => r.rate)
    : [...RANK_SURCHARGE_RATES];

  // trimId → RateConfigData[] 맵
  const ratesByTrimId = new Map<string, RateConfigData[]>();
  for (const rs of allSheets) {
    const minRateMatrix = parseRateSheetRaw(rs.minRateMatrix);
    const maxRateMatrix = parseRateSheetRaw(rs.maxRateMatrix);
    if (!minRateMatrix || !maxRateMatrix) continue;
    const data: RateConfigData = {
      financeCompanyId: rs.financeCompanyId,
      financeCompanyName: rs.financeCompany.name,
      financeSurchargeRate: rs.financeCompany.surchargeRate,
      minVehiclePrice: rs.minVehiclePrice,
      maxVehiclePrice: rs.maxVehiclePrice,
      minRateMatrix,
      maxRateMatrix,
      depositDiscountRate: rs.depositDiscountRate,
      prepayAdjustRate: rs.prepayAdjustRate,
    };
    const existing = ratesByTrimId.get(rs.trimId) ?? [];
    existing.push(data);
    ratesByTrimId.set(rs.trimId, existing);
  }

  // 약정거리 매핑 (고객 입력 → 가장 가까운 키)
  const mileageKey = closestMileage(input.annualMileage);

  // 3) 차량별 점수 계산
  const scored: LegacyScoredVehicle[] = [];

  const preferences = input.preferences ?? [];
  // "고급"(구 임원용·의전)은 6천만원 미만 제외 + 최상위 트림 노출 게이트를 유지한다.
  const isOfficial = preferences.includes("고급");
  // LLM 추천 이유용 라벨 — 신규는 선호 라벨, 옛 세션은 목적 문자열
  const preferenceLabel =
    preferences.length > 0
      ? preferences.map((p) => PREFERENCE_OPTIONS.find((o) => o.value === p)?.label ?? p).join(", ")
      : input.purpose ?? "";

  for (const v of vehicles) {
    const defaultTrim = pickRecommendationTrim(v.trims, isOfficial);
    if (!defaultTrim) continue;
    // 임원용·의전은 6천만원 미만 차량을 추천 후보에서 하드 제외(노출 안 함).
    // scoring-rules의 의전 가격 패널티(-15/-25)는 이 게이트가 제거될 경우의 방어선.
    if (isOfficial && defaultTrim.price < 60_000_000) continue;

    // trimId로 RateConfigData 찾기
    const configs = ratesByTrimId.get(defaultTrim.id);
    if (!configs || configs.length === 0) continue;

    // 최저가 금융사 찾기 (표준형, 48개월 기준)
    let bestMonthly = Infinity;

    for (const cfg of configs) {
      const monthly = estimateMonthly(defaultTrim.price, cfg, 48, mileageKey);
      if (monthly > 0 && monthly < bestMonthly) {
        bestMonthly = monthly;
      }
    }

    if (bestMonthly === Infinity || bestMonthly <= 0) continue;

    // ── 스코어링 (속성 추출 + 규칙 기반) ─────────────
    const recConfig = v.recConfigs ?? null;
    const attrs = buildVehicleAttrs(
      {
        name: v.name,
        isPopular: v.isPopular,
        slidingDoorOverride: v.slidingDoorOverride,
        advancedSafetyOverride: v.advancedSafetyOverride,
      },
      {
        name: defaultTrim.name,
        engineType: defaultTrim.engineType,
        detailedSpecs: defaultTrim.detailedSpecs,
        options: defaultTrim.options,
      },
    );

    const scoreMatrixBonus = readLegacyScoreMatrixBonus(
      recConfig?.scoreMatrix,
      input.industry,
      input.purpose,
    );

    const { score, reasons } = scoreVehicle(
      {
        industry: input.industry,
        preferences,
        primaryPreference: input.primaryPreference,
        situationPreference: input.situationPreference,
        childDetail: input.childDetail,
        cargoDetail: input.cargoDetail,
        annualMileage: input.annualMileage,
        residenceRegion: input.residenceRegion,
        fuelPreference: input.fuelPreference,
        chargingEnvironment: input.chargingEnvironment,
      },
      attrs,
      {
        category: v.category ?? "",
        price: defaultTrim.price,
        fuelEfficiency: defaultTrim.fuelEfficiency,
        scoreMatrixBonus,
      },
    );

    // ── 추천 이유 / 배지 ─────────────────────────────
    const reason =
      reasons.length > 0
        ? reasons.slice(0, 3).join(". ") + "."
        : recConfig?.aiCaption ?? `${v.name}은(는) 이 조건에 적합한 차량이에요.`;

    const highlights: string[] = [...(recConfig?.highlights ?? [])];
    if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 15) {
      highlights.push("고연비");
    }

    const scenarios = buildRecommendScenarios({
      vehiclePrice: defaultTrim.price,
      annualMileage: mileageKey,
      vehicleSurchargeRate: v.surchargeRate,
      rankSurchargeRates: rankRates,
      rateConfigs: configs,
      estimatedMonthly: bestMonthly,
    });

    scored.push({
      vehicleId: v.id,
      modelKey: getRecommendationModelKey({
        brand: v.brand,
        name: v.name,
        defaultTrimName: defaultTrim.name,
        lineupName: defaultTrim.lineup?.name,
      }),
      modelYear: getRecommendationModelYear({
        brand: v.brand,
        name: v.name,
        defaultTrimName: defaultTrim.name,
        lineupName: defaultTrim.lineup?.name,
      }),
      score,
      reason,
      highlights: highlights.slice(0, 4),
      estimatedMonthly: bestMonthly,
      detail: {
        name: v.name,
        brand: v.brand,
        category: v.category,
        thumbnailUrl: resolvePublicThumbnailUrl(v),
        imageUrls: canUseLegacyImageFallback(v) ? v.imageUrls : [],
        defaultTrimName: defaultTrim.name,
        defaultTrimPrice: defaultTrim.price,
        slug: v.slug,
        popularConfigs: v.popularConfigs.map((c) => ({
          id: c.id,
          name: c.name,
          note: c.note,
          items: c.items.map((i) => ({ id: i.id, name: i.name, price: i.price, trimOptionId: i.trimOptionId })),
        })),
      },
      scenarios,
    });
  }

  // 4) 점수 정렬 → 상위 3개
  const latestScored = latestByRecommendationModel(scored);
  latestScored.sort((a, b) => b.score - a.score);
  const top = latestScored.slice(0, 3);

  return finalizeLegacyRecommendations(top, input, preferenceLabel);
}

/** 고객 입력 연간주행거리를 가장 가까운 회수율 키로 매핑 */
function closestMileage(annualMileage: number): 10_000 | 20_000 | 30_000 {
  const options = [10_000, 20_000, 30_000] as const;
  let closest: (typeof options)[number] = options[0];
  let minDiff = Math.abs(annualMileage - options[0]);
  for (const opt of options) {
    const diff = Math.abs(annualMileage - opt);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt;
    }
  }
  return closest;
}
