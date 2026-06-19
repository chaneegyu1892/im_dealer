/**
 * AI 추천 엔진 — 회수율 기반 견적 + 규칙 기반 스코어링 (예산 제거 버전)
 *
 * 1) 노출 가능 차량 조회
 * 2) vehicleCode로 RateConfig 매핑 → 최저가 금융사 견적 산출 (결과 표시용 bestMonthly)
 * 3) 차량 카테고리 × 업종·목적 가중치 → 상위 3개 추천 (예산 비교·필터 없음)
 * 4) 3개 시나리오(무보증/보증금/선납금) 계산
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

const BASE_SCORE = 50;
const MAX_SCORE = 250;

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
  const chargingEnvironment = input.chargingEnvironment;

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
  const allSheets = await (prisma as any).capitalRateSheet.findMany({
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
      minRateMatrix: rs.minRateMatrix,
      maxRateMatrix: rs.maxRateMatrix,
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
    let score = BASE_SCORE;
    const recConfig = v.recConfigs ?? null;
    const cat = v.category ?? "";
    const trimFuel = defaultTrim.engineType ?? "";

    // (b) 추천 설정 점수 행렬 — 예산 제거로 변별력 확보 위해 영향력 2배(/5)
    if (recConfig?.scoreMatrix) {
      const matrix = recConfig.scoreMatrix as Record<string, Record<string, number>>;
      const purposeScore = matrix[input.industry]?.[input.purpose] ?? 0;
      score += purposeScore / 5;
    }

    // (c) 인기 차량 가산
    if (v.isPopular) score += 5;

    // (d) 업종 추가 답변 스코어링
    if (input.industryDetail) {
      if (input.industry === "법인" && input.industryDetail === "6대 이상") {
        if (cat !== "SUV") score += 5;
      }
      if (input.industry === "개인사업자" && input.industryDetail === "비용처리 중요") {
        score += 3;
      }
      if (input.industry === "직장인" && input.industryDetail === "자가용 주요") {
        if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 12) score += 5;
      }
      if (input.industry === "개인" && input.industryDetail === "4명 이상") {
        // 가정 4명 이상 → 중대형 SUV 우선
        if (cat === "SUV" || cat.includes("대형")) score += 15;
        else if (cat.includes("경차") || cat.includes("소형")) score -= 10;
      }
    }

    // (e) 목적 추가 답변 스코어링 — 카테고리 × 용도 가중치 강화
    if (input.purposeDetail) {
      if (input.purpose === "출퇴근" && input.purposeDetail === "30km 이상") {
        if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 14) score += 5;
      }
      if (input.purpose === "영업·외근" && input.purposeDetail === "매일") {
        score += 5;
      }
      if (input.purpose === "가족" && input.purposeDetail === "영유아") {
        if (cat === "SUV") score += 12;
        else if (cat.includes("대형")) score += 8;
        else if (cat.includes("경차") || cat.includes("소형")) score -= 8;
      }
      if (input.purpose === "화물·배달") {
        // 화물·배달은 카테고리 강제: 트럭/밴 외에는 강하게 감점
        if (cat === "밴" || cat === "트럭") {
          score += 20;
          if (input.purposeDetail === "대형 화물") score += 10;
        } else {
          score -= 25;
        }
      }
      if (input.purpose === "기타" && input.purposeDetail === "평일 포함 자주") {
        if (defaultTrim.fuelEfficiency && defaultTrim.fuelEfficiency > 12) score += 3;
      }
      if (input.purpose === "의전·임원용" && input.purposeDetail === "기사 운행") {
        if (cat.includes("대형") || cat.includes("세단")) score += 10;
      }
      if (input.purpose === "첫차") {
        const price = defaultTrim.price;
        if (input.purposeDetail === "면허 신규") {
          if (cat.includes("경차") || cat.includes("소형")) score += 8;
          else if (cat === "SUV" && price < 35_000_000) score += 4;
          else if (cat.includes("대형") || cat === "트럭" || cat === "밴") score -= 8;
        }
        if (price < 35_000_000) score += 3;
      }
      if (input.purpose === "레저·캠핑") {
        if (input.purposeDetail === "차박·캠핑") {
          if (cat === "SUV" || cat.includes("대형") || cat === "밴") score += 10;
          else if (cat.includes("세단") || cat.includes("경차")) score -= 5;
        }
        if (input.purposeDetail === "스포츠·레저장비") {
          if (cat === "SUV" || cat.includes("해치백")) score += 6;
        }
      }
    }

    // (g-1) 의전·임원용 카테고리 가중치
    if (isOfficial) {
      if (cat.includes("대형") || cat.includes("세단") || cat.includes("프리미엄")) {
        score += 15;
      } else if (cat === "SUV") {
        score += 8;
      } else if (cat.includes("경차") || cat.includes("소형") || cat === "밴" || cat === "트럭") {
        score -= 15;
      }
    }

    // (g) 연료 방식 스코어링 — 전기차 충전환경 "없음" 인 경우 EV 감점 + 보너스 무효
    if (input.fuelPreference && input.fuelPreference !== "상관없음") {
      const noCharging = chargingEnvironment === "없음";
      if (input.fuelPreference === "전기차" && trimFuel.includes("전기")) {
        if (!noCharging) score += 15;
        // noCharging=true 인 경우 매칭 보너스 무효화
      } else if (input.fuelPreference === "하이브리드" && trimFuel.includes("하이브리드")) {
        score += 15;
      } else if (input.fuelPreference === "가솔린/디젤" &&
        (trimFuel.includes("가솔린") || trimFuel.includes("디젤"))) {
        score += 5;
      } else if (input.fuelPreference !== "상관없음") {
        score -= 5;
      }
    }

    // (h) 충전환경 "없음" + EV 차량은 추가 감점 (다른 차는 영향 없음)
    if (chargingEnvironment === "없음" && trimFuel.includes("전기")) {
      score -= 15;
    }

    // 상한선 클램핑
    score = Math.min(MAX_SCORE, score);

    // ── 추천 이유 생성 ────────────────────────────
    const reasons: string[] = [];

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
    if (input.purpose === "첫차" && defaultTrim.price < 35_000_000) {
      reasons.push("합리적인 가격대로 첫차에 부담 없어요");
    }
    if (input.purpose === "레저·캠핑" && (v.category === "SUV" || v.category?.includes("대형") || v.category === "밴")) {
      reasons.push("넓은 적재공간으로 레저·캠핑에 적합해요");
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
        imageUrls: v.imageUrls,
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
        budgetMax: 0,
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
