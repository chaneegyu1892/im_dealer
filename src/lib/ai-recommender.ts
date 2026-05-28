/**
 * AI 추천 엔진 — 회수율 기반 견적 + DB 설정 기반 스코어링
 */

import { prisma } from "@/lib/prisma";
import { generateReason } from "@/lib/llm-reason";
import {
  estimateMonthly,
  calculateMultiFinanceQuote,
  type RateConfigData,
  type CalcInput,
} from "@/lib/quote-calculator";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import { getRecommendFlowConfig, type ScoringConfig } from "@/lib/recommend-config";
import type {
  RecommendInput,
  RecommendedVehicle,
  RecommendedVehicleDetail,
  RecommendScenarios,
} from "@/types/recommendation";

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
  // 1) 설정 + 차량 + 회수율 동시 조회
  const [flowConfig, vehicles, allSheets, rankSurcharges] = await Promise.all([
    getRecommendFlowConfig(),
    prisma.vehicle.findMany({
      where: { isVisible: true },
      include: {
        trims: { where: { isVisible: true }, orderBy: { isDefault: "desc" } },
        recConfigs: { where: { isActive: true } },
        popularConfigs: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          include: { items: { orderBy: { displayOrder: "asc" } } },
        },
      },
    }),
    (prisma as any).capitalRateSheet.findMany({
      where: { isActive: true, financeCompany: { isActive: true } },
      include: { financeCompany: true },
    }),
    prisma.rankSurchargeConfig.findMany({ orderBy: { rank: "asc" } }),
  ]);

  const sc = flowConfig.scoring;

  const rankRates = rankSurcharges.length > 0
    ? rankSurcharges.map((r) => r.rate)
    : [...RANK_SURCHARGE_RATES];

  // trimId → RateConfigData[] 맵
  const ratesByTrimId = new Map<string, RateConfigData[]>();
  for (const rs of allSheets) {
    const data: RateConfigData = {
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
    const existing = ratesByTrimId.get(rs.trimId) ?? [];
    existing.push(data);
    ratesByTrimId.set(rs.trimId, existing);
  }

  const mileageKey = closestMileage(input.annualMileage);
  const isOfficial = input.purpose === "임원용·의전";
  const scored: ScoredVehicle[] = [];

  for (const v of vehicles) {
    let defaultTrim = v.trims.find((t) => t.isDefault) ?? v.trims[0];
    if (isOfficial && v.trims.length > 0) {
      defaultTrim = v.trims.reduce((max, t) => (t.price > max.price ? t : max), v.trims[0]);
    }
    if (!defaultTrim) continue;
    if (isOfficial && defaultTrim.price < sc.official.minPrice) continue;

    const configs = ratesByTrimId.get(defaultTrim.id);
    if (!configs || configs.length === 0) continue;

    // 최저가 금융사
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

    // ── 스코어링 ──────────────────────────────────────
    let score = sc.baseScore;
    const recConfig = v.recConfigs ?? null;
    const cat = v.category ?? "";
    const trimFuel = (defaultTrim as { fuelType?: string }).fuelType ?? "";

    // (a) 예산 적합도
    const effectiveBudgetMax = input.budgetDetail === "조금 타협 가능"
      ? input.budgetMax * sc.budget.flexibleMultiplier
      : input.budgetMax;

    if (bestMonthly >= input.budgetMin && bestMonthly <= input.budgetMax) {
      score += sc.budget.withinBudgetBonus;
    } else if (bestMonthly < input.budgetMin) {
      score += sc.budget.underBudgetBonus;
    } else {
      const over = bestMonthly - input.budgetMax;
      score -= Math.min(sc.budget.maxPenalty, Math.round(over / 10000) * sc.budget.overBudgetPenaltyPerManwon);
    }
    // 유연 예산 범위 안이면 소폭 가산
    if (bestMonthly > input.budgetMax && bestMonthly <= effectiveBudgetMax) {
      score += 10;
    }

    // (b) per-vehicle 추천 행렬
    if (recConfig?.scoreMatrix) {
      const matrix = recConfig.scoreMatrix as Record<string, Record<string, number>>;
      score += (matrix[input.industry]?.[input.purpose] ?? 0) / 10;
    }

    // (c) 인기 가산
    if (v.isPopular) score += sc.popularBonus;

    // (d) 업종 추가답변 — DB 규칙
    if (input.industryDetail) {
      for (const rule of sc.industryDetail) {
        if (rule.industry !== input.industry) continue;
        if (rule.detail !== input.industryDetail) continue;
        score += applyCondition(rule.condition, rule.score, { cat, trim: defaultTrim, v, rule });
      }
    }

    // (e) 목적 추가답변 — DB 규칙
    if (input.purposeDetail) {
      for (const rule of sc.purposeDetail) {
        if (rule.purpose !== input.purpose) continue;
        if (rule.detail !== input.purposeDetail) continue;
        score += applyCondition(rule.condition, rule.score, { cat, trim: defaultTrim, v, rule });
      }
    }

    // (f) 의전·임원용
    if (isOfficial) {
      if (cat.includes("대형") || cat.includes("세단") || cat.includes("프리미엄")) {
        score += sc.official.premiumCategoryBonus;
      } else if (cat === "SUV") {
        score += sc.official.suvBonus;
      } else if (cat.includes("경차") || cat.includes("소형") || cat === "밴" || cat === "트럭") {
        score -= sc.official.smallCategoryPenalty;
      }
    }

    // (g) 연료방식
    if (input.fuelPreference && input.fuelPreference !== "상관없음") {
      if (input.fuelPreference === "전기차" && trimFuel.includes("전기")) score += sc.fuel["전기차"];
      else if (input.fuelPreference === "하이브리드" && trimFuel.includes("하이브리드")) score += sc.fuel["하이브리드"];
      else if (input.fuelPreference === "가솔린/디젤" && (trimFuel.includes("가솔린") || trimFuel.includes("디젤"))) score += sc.fuel["가솔린/디젤"];
      else score -= sc.fuel.mismatchPenalty;
    }

    // 예산 상한 40% 초과 차량 제외 (의전 제외)
    if (!isOfficial && bestMonthly > effectiveBudgetMax * sc.budget.maxBudgetRatio) continue;

    // ── 추천 이유 ───────────────────────────────────
    const reasons: string[] = [];
    if (bestMonthly >= input.budgetMin && bestMonthly <= input.budgetMax) {
      reasons.push("예산 범위 안에 있는 차량이에요");
    } else if (bestMonthly < input.budgetMin) {
      reasons.push("예산보다 여유 있는 선택이에요");
    }
    if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > sc.highFuelEffThreshold) {
      if (input.purpose === "출퇴근·업무용") {
        reasons.push("연비가 좋아 출퇴근 비용을 절약할 수 있어요");
        score += sc.highFuelEffBonus;
      }
    }
    if (input.purpose === "가정용" && cat === "SUV") {
      reasons.push("가족 이동에 넉넉한 SUV예요");
      score += sc.familySuvBonus;
    }
    if (input.purpose === "화물·배달" && (cat === "밴" || cat === "트럭")) {
      reasons.push("화물 적재에 적합한 차량이에요");
      score += sc.cargoBonus;
    }
    if (input.industry === "법인" || input.industry === "개인사업자") {
      reasons.push("비용처리에 유리한 조건이에요");
    }

    const reason = reasons.length > 0
      ? reasons.join(". ") + "."
      : recConfig?.aiCaption ?? `${v.name}은(는) 이 조건에 적합한 차량이에요.`;

    const highlights: string[] = [...(recConfig?.highlights ?? [])];
    if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > sc.highFuelEffThreshold) {
      highlights.push("고연비");
    }

    // 3개 시나리오
    const scenarioConditions = [
      { key: "conservative" as const, depositRate: 20, prepayRate: 0 },
      { key: "standard" as const,     depositRate: 0,  prepayRate: 0 },
      { key: "aggressive" as const,   depositRate: 0,  prepayRate: 30 },
    ];
    const scenarioEntries: Partial<RecommendScenarios> = {};
    for (const sc2 of scenarioConditions) {
      const calcInput: CalcInput = {
        vehiclePrice: defaultTrim.price,
        contractMonths: 48,
        annualMileage: mileageKey,
        depositRate: sc2.depositRate,
        prepayRate: sc2.prepayRate,
        vehicleSurchargeRate: v.surchargeRate,
        rankSurchargeRates: rankRates,
        rateConfigs: configs,
      };
      const results = calculateMultiFinanceQuote(calcInput);
      const best = results[0];
      scenarioEntries[sc2.key] = best
        ? { monthlyPayment: best.monthlyPayment, depositAmount: best.breakdown.depositAmount, prepayAmount: best.breakdown.prepayAmount, contractMonths: 48, annualMileage: mileageKey, contractType: "반납형" }
        : { monthlyPayment: bestMonthly, depositAmount: 0, prepayAmount: 0, contractMonths: 48, annualMileage: mileageKey, contractType: "반납형" };
    }

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
        imageUrls: v.imageUrls,
        defaultTrimName: defaultTrim.name,
        defaultTrimPrice: defaultTrim.price,
        slug: v.slug,
        popularConfigs: v.popularConfigs.map((c) => ({
          id: c.id, name: c.name, note: c.note,
          items: c.items.map((i) => ({ id: i.id, name: i.name, price: i.price, trimOptionId: i.trimOptionId })),
        })),
      },
      scenarios: scenarioEntries as RecommendScenarios,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  const llmReasons = await Promise.all(
    top.map((s) =>
      generateReason({
        industry: input.industry,
        purpose: input.purpose,
        budgetMax: input.budgetMax,
        annualMileage: input.annualMileage,
        vehicleName: s.detail.name,
        brand: s.detail.brand,
        category: s.detail.category,
        estimatedMonthly: s.estimatedMonthly,
        fallback: s.reason,
      })
    )
  );

  return top.map((s, i): RecommendedVehicle => ({
    vehicleId: s.vehicleId,
    rank: i + 1,
    score: s.score,
    reason: llmReasons[i],
    highlights: s.highlights,
    estimatedMonthly: s.estimatedMonthly,
    vehicle: s.detail,
    scenarios: s.scenarios,
  }));
}

// ── 조건 평가 헬퍼 ────────────────────────────────────────

function applyCondition(
  condition: string,
  score: number,
  ctx: { cat: string; trim: { fuelEfficiency?: number | null; price: number }; v: { category?: string }; rule: { conditionParam?: number } }
): number {
  const { cat, trim, rule } = ctx;
  switch (condition) {
    case "always":
      return score;
    case "suv":
      return cat === "SUV" ? score : 0;
    case "largeCat":
      return (cat === "SUV" || cat.includes("대형")) ? score : 0;
    case "heavyCat":
      return (cat === "밴" || cat === "트럭") ? score : 0;
    case "otherCat":
      return (cat !== "밴" && cat !== "트럭") ? score : 0;
    case "premiumCat":
      return (cat.includes("대형") || cat.includes("세단")) ? score : 0;
    case "nonSUV":
      return cat !== "SUV" ? score : 0;
    case "highFuelEff": {
      const threshold = rule.conditionParam ?? 14;
      return (trim.fuelEfficiency && trim.fuelEfficiency > threshold) ? score : 0;
    }
    case "highPrice": {
      const minPrice = rule.conditionParam ?? 40_000_000;
      return trim.price > minPrice ? score : 0;
    }
    default:
      return 0;
  }
}

function closestMileage(annualMileage: number): number {
  const options = [10000, 20000, 30000];
  return options.reduce((closest, opt) =>
    Math.abs(opt - annualMileage) < Math.abs(closest - annualMileage) ? opt : closest
  );
}
