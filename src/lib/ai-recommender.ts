/**
 * AI 추천 엔진 — 회수율 기반 견적 + 규칙 기반 스코어링
 *
 * 1) 노출 가능 차량 조회
 * 2) vehicleCode로 RateConfig 매핑 → 최저가 금융사 견적 산출
 * 3) 예산 적합도 + 업종·목적 스코어 → 상위 3개 추천
 * 4) 3개 시나리오(보수형/표준형/공격형) 계산
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
import type {
  RecommendInput,
  RecommendedVehicle,
  RecommendedVehicleDetail,
  RecommendScenarios,
} from "@/types/recommendation";
import type { RateSheetRaw } from "@/types/admin";

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
      popularConfigs: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        include: { items: { orderBy: { displayOrder: "asc" } } },
      },
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
    const data: RateConfigData = {
      financeCompanyId: rs.financeCompanyId,
      financeCompanyName: rs.financeCompany.name,
      financeSurchargeRate: rs.financeCompany.surchargeRate,
      minVehiclePrice: rs.minVehiclePrice,
      maxVehiclePrice: rs.maxVehiclePrice,
      minRateMatrix: rs.minRateMatrix as RateSheetRaw,
      maxRateMatrix: rs.maxRateMatrix as RateSheetRaw,
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
  const scored: ScoredVehicle[] = [];

  const isOfficial = input.purpose === "의전·임원용";

  for (const v of vehicles) {
    let defaultTrim = v.trims.find((t) => t.isDefault) ?? v.trims[0];
    if (isOfficial && v.trims.length > 0) {
      const mostExpensive = v.trims.reduce((max, t) => (t.price > max.price ? t : max), v.trims[0]);
      defaultTrim = mostExpensive;
    }
    if (!defaultTrim) continue;
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

    // ── 스코어링 ─────────────────────────────────
    let score = 50;
    const recConfig = v.recConfigs ?? null;

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

    // (d) 업종 추가 답변 스코어링
    if (input.industryDetail) {
      if (input.industry === "법인" && input.industryDetail === "6대 이상") {
        if (v.category !== "SUV") score += 5;
      }
      if (input.industry === "개인사업자" && input.industryDetail === "비용처리 중요") {
        score += 3;
      }
      if (input.industry === "직장인" && input.industryDetail === "자가용 주요") {
        if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 12) score += 5;
      }
      if (input.industry === "개인" && input.industryDetail === "4명 이상") {
        if (v.category === "SUV" || v.category === "대형") score += 8;
      }
    }

    // (e) 목적 추가 답변 스코어링
    if (input.purposeDetail) {
      if (input.purpose === "출퇴근" && input.purposeDetail === "30km 이상") {
        if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 14) score += 5;
      }
      if (input.purpose === "영업·외근" && input.purposeDetail === "매일") {
        score += 5;
      }
      if (input.purpose === "가족" && input.purposeDetail === "영유아") {
        if (v.category === "SUV") score += 8;
      }
      if (input.purpose === "화물·배달" && input.purposeDetail === "대형 화물") {
        if (v.category === "밴" || v.category === "트럭") score += 10;
        else score -= 10;
      }
      if (input.purpose === "기타" && input.purposeDetail === "평일 포함 자주") {
        if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 12) score += 3;
      }
      if (input.purpose === "의전·임원용" && input.purposeDetail === "기사 운행") {
        if (v.category?.includes("대형") || v.category?.includes("세단")) score += 10;
      }
    }

    // (f) 예산 추가 답변 스코어링
    const effectiveBudgetMax = (input.budgetDetail === "조금 타협 가능")
      ? input.budgetMax * 1.1
      : input.budgetMax;

    if (bestMonthly <= effectiveBudgetMax && bestMonthly > input.budgetMax) {
      score += 10;
    }
    if (input.budgetDetail === "300만원 이상" && input.paymentStyle === "공격형") {
      if (defaultTrim.price > 40_000_000) score += 5;
    }

    // (g-1) 의전·임원용 스코어링
    if (isOfficial) {
      const cat = v.category ?? "";
      if (cat.includes("대형") || cat.includes("세단") || cat.includes("프리미엄")) {
        score += 15;
      } else if (cat === "SUV") {
        score += 8;
      } else if (cat.includes("경차") || cat.includes("소형") || cat === "밴" || cat === "트럭") {
        score -= 15;
      }
    }

    // (g) 연료 방식 스코어링
    if (input.fuelPreference && input.fuelPreference !== "상관없음") {
      const trimFuel = (defaultTrim as { fuelType?: string }).fuelType ?? "";
      if (input.fuelPreference === "전기차" && trimFuel.includes("전기")) score += 15;
      else if (input.fuelPreference === "하이브리드" && trimFuel.includes("하이브리드")) score += 15;
      else if (input.fuelPreference === "가솔린/디젤" &&
        (trimFuel.includes("가솔린") || trimFuel.includes("디젤"))) score += 5;
      else if (input.fuelPreference !== "상관없음") score -= 5;
    }

    // 의전용은 예산 필터 적용 안 함, 그 외 40% 초과 시 제외
    if (!isOfficial && bestMonthly > effectiveBudgetMax * 1.4) continue;

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
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  // 5) LLM으로 추천 이유 병렬 생성 (실패 시 규칙 기반 reason 사용)
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
