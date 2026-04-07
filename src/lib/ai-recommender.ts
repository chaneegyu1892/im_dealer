/**
 * AI 추천 엔진 — 회수율 기반 견적 + 규칙 기반 스코어링
 *
 * 1) 노출 가능 차량 조회
 * 2) vehicleCode로 RateConfig 매핑 → 최저가 금융사 견적 산출
 * 3) 예산 적합도 + 업종·목적 스코어 → 상위 3개 추천
 * 4) 3개 시나리오(보수형/표준형/공격형) 계산
 */

import { prisma } from "@/lib/prisma";
import {
  estimateMonthly,
  calculateMultiFinanceQuote,
  type RateConfigData,
  type CalcInput,
} from "@/lib/quote-calculator";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import type {
  RecommendInput,
  RecommendedVehicle,
  RecommendedVehicleDetail,
  RecommendScenarios,
} from "@/types/recommendation";
import type { RateMatrix } from "@/types/quote";

interface ScoredVehicle {
  vehicleId: string;
  score: number;
  reason: string;
  highlights: string[];
  detail: RecommendedVehicleDetail;
  scenarios: RecommendScenarios;
  estimatedMonthly: number;
}

export async function recommend(input: RecommendInput): Promise<RecommendedVehicle[]> {
  // 1) 노출 가능 차량 + 추천설정 조회
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    include: {
      trims: { where: { isVisible: true }, orderBy: { isDefault: "desc" } },
      recConfigs: { where: { isActive: true } },
    },
  });

  // 2) 활성 금융사의 RateConfig 전체 조회
  const rateConfigs = await prisma.rateConfig.findMany({
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

  // vehicleCode → RateConfigData[] 맵
  const ratesByCode = new Map<string, RateConfigData[]>();
  for (const rc of rateConfigs) {
    const key = rc.vehicleCode;
    const data: RateConfigData = {
      financeCompanyId: rc.financeCompanyId,
      financeCompanyName: rc.financeCompany.name,
      minVehiclePrice: rc.minVehiclePrice,
      maxVehiclePrice: rc.maxVehiclePrice,
      minPriceRates: rc.minPriceRates as RateMatrix,
      maxPriceRates: rc.maxPriceRates as RateMatrix,
      depositDiscountRate: rc.depositDiscountRate,
      prepayAdjustRate: rc.prepayAdjustRate,
      financeSurchargeRate: rc.financeCompany.surchargeRate,
    };
    const existing = ratesByCode.get(key) ?? [];
    existing.push(data);
    ratesByCode.set(key, existing);
  }

  // 약정거리 매핑 (고객 입력 → 가장 가까운 키)
  const mileageKey = closestMileage(input.annualMileage);

  // 3) 차량별 점수 계산
  const scored: ScoredVehicle[] = [];

  for (const v of vehicles) {
    const defaultTrim = v.trims.find((t) => t.isDefault) ?? v.trims[0];
    if (!defaultTrim) continue;

    // 공통코드로 RateConfig 찾기
    const configs = v.vehicleCode ? ratesByCode.get(v.vehicleCode) : undefined;
    if (!configs || configs.length === 0) continue;

    // 최저가 금융사 찾기 (표준형, 48개월 기준)
    let bestConfig = configs[0];
    let bestMonthly = Infinity;

    for (const cfg of configs) {
      const monthly = estimateMonthly(defaultTrim.price, cfg, 48, mileageKey);
      if (monthly > 0 && monthly < bestMonthly) {
        bestMonthly = monthly;
        bestConfig = cfg;
      }
    }

    if (bestMonthly === Infinity || bestMonthly <= 0) continue;

    // ── 스코어링 ─────────────────────────────────
    let score = 50;
    const recConfig = v.recConfigs[0] ?? null;

    // (a) 예산 적합도
    if (bestMonthly >= input.budgetMin && bestMonthly <= input.budgetMax) {
      score += 30;
    } else if (bestMonthly < input.budgetMin) {
      score += 15;
    } else {
      const over = bestMonthly - input.budgetMax;
      score -= Math.min(40, Math.round(over / 10000));
    }

    // (b) 추천 설정 점수 행렬
    if (recConfig?.scoreMatrix) {
      const matrix = recConfig.scoreMatrix as Record<string, Record<string, number>>;
      const purposeScore = matrix[input.industry]?.[input.purpose] ?? 0;
      score += purposeScore / 10;
    }

    // (c) 인기 차량 가산
    if (v.isPopular) score += 5;

    // 예산 40% 초과 시 제외
    if (bestMonthly > input.budgetMax * 1.4) continue;

    // ── 추천 이유 생성 ────────────────────────────
    const reasons: string[] = [];
    if (bestMonthly >= input.budgetMin && bestMonthly <= input.budgetMax) {
      reasons.push("예산 범위 안에 있는 차량이에요");
    } else if (bestMonthly < input.budgetMin) {
      reasons.push("예산보다 여유 있는 선택이에요");
    }

    if (input.purpose === "출퇴근" && defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 14) {
      reasons.push("연비가 좋아 출퇴근 비용을 절약할 수 있어요");
      score += 3;
    }
    if (input.purpose === "가족" && v.category === "SUV") {
      reasons.push("가족 이동에 넉넉한 SUV예요");
      score += 5;
    }
    if (input.purpose === "화물·배달" && (v.category === "밴" || v.category === "트럭")) {
      reasons.push("화물 적재에 적합한 차량이에요");
      score += 5;
    }
    if (input.industry === "법인" || input.industry === "개인사업자") {
      reasons.push("비용처리에 유리한 조건이에요");
    }

    const reason = reasons.length > 0
      ? reasons.join(". ") + "."
      : recConfig?.aiCaption ?? `${v.name}은(는) 이 조건에 적합한 차량이에요.`;

    // 특징 배지
    const highlights: string[] = [...(recConfig?.highlights ?? [])];
    if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 15) {
      highlights.push("고연비");
    }

    // ── 3개 시나리오 계산 (전체 파이프라인) ──────────
    const scenarioConditions = [
      { key: "conservative" as const, depositRate: 20, prepayRate: 0 },
      { key: "standard" as const,     depositRate: 0,  prepayRate: 0 },
      { key: "aggressive" as const,   depositRate: 0,  prepayRate: 30 },
    ];

    const scenarioEntries: Partial<RecommendScenarios> = {};
    for (const sc of scenarioConditions) {
      const calcInput: CalcInput = {
        vehiclePrice: defaultTrim.price,
        contractMonths: 48,
        annualMileage: mileageKey,
        depositRate: sc.depositRate,
        prepayRate: sc.prepayRate,
        vehicleSurchargeRate: v.surchargeRate,
        rankSurchargeRates: rankRates,
        rateConfigs: configs,
      };

      const results = calculateMultiFinanceQuote(calcInput);
      const best = results[0];

      scenarioEntries[sc.key] = best
        ? {
            monthlyPayment: best.monthlyPayment,
            depositAmount: best.breakdown.depositAmount,
            prepayAmount: best.breakdown.prepayAmount,
            contractMonths: 48,
            annualMileage: mileageKey,
            contractType: "반납형",
          }
        : {
            monthlyPayment: bestMonthly,
            depositAmount: 0,
            prepayAmount: 0,
            contractMonths: 48,
            annualMileage: mileageKey,
            contractType: "반납형",
          };
    }

    const scenarios = scenarioEntries as RecommendScenarios;

    scored.push({
      vehicleId: v.id,
      score,
      reason,
      highlights: highlights.slice(0, 4),
      estimatedMonthly: bestMonthly,
      detail: {
        name: v.name,
        brand: v.brand,
        category: v.category,
        thumbnailUrl: v.thumbnailUrl,
        defaultTrimName: defaultTrim.name,
        defaultTrimPrice: defaultTrim.price,
        slug: v.slug,
      },
      scenarios,
    });
  }

  // 4) 점수 정렬 → 상위 3개
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  return top.map((s, i): RecommendedVehicle => ({
    vehicleId: s.vehicleId,
    rank: i + 1,
    score: s.score,
    reason: s.reason,
    highlights: s.highlights,
    estimatedMonthly: s.estimatedMonthly,
    vehicle: s.detail,
    scenarios: s.scenarios,
  }));
}

/** 고객 입력 연간주행거리를 가장 가까운 회수율 키로 매핑 */
function closestMileage(annualMileage: number): number {
  const options = [10000, 20000, 30000];
  let closest = options[0];
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
