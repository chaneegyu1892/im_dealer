import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  calculateMultiFinanceQuote,
  type RateConfigData,
  type CalcInput,
} from "@/lib/quote-calculator";
import type { FinanceQuoteResult } from "@/types/quote";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";

const quoteSchema = z.object({
  trimId: z.string().optional(),
  selectedOptionIds: z.array(z.string()).optional(),
  extraOptionsPrice: z.number().int().min(0).optional(),
  contractMonths: z.number().int().refine((v) => [36, 48, 60].includes(v)),
  annualMileage: z.number().int().refine((v) => [10000, 20000, 30000].includes(v)),
  contractType: z.enum(["인수형", "반납형"]),
  productType: z.enum(["장기렌트", "리스"]).default("장기렌트"),
  customerType: z.enum(["individual", "self_employed", "corporate", "nonprofit"]).default("individual"),
  customDepositRate: z.number().int().min(0).max(30).optional(),
  customPrepayRate: z.number().int().min(0).max(30).optional(),
});

// ── 시나리오별 보증금·선납금 조건 ───────────────────────
const SCENARIO_CONDITIONS = {
  conservative: { depositRate: 20, prepayRate: 0 },  // 보수형: 보증금 20%
  standard:     { depositRate: 0,  prepayRate: 0 },   // 표준형: 없음
  aggressive:   { depositRate: 0,  prepayRate: 30 },  // 공격형: 선납금 30%
} as const;

// ─── POST /api/vehicles/:slug/quote ─────────────────────
// 조건별 3개 시나리오 견적 (전체 파이프라인: 선형보간 → 보증금/선납금 → 순위가산 + 차량가산 + 금융사가산)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const input = quoteSchema.parse(body);

    // 1) 차량 + 트림 조회
    const vehicle = await prisma.vehicle.findUnique({
      where: { slug },
      include: {
        trims: {
          where: { isVisible: true },
          orderBy: { isDefault: "desc" },
          include: { options: { select: { id: true, price: true } } },
        },
      },
    });

    if (!vehicle || !vehicle.isVisible) {
      return NextResponse.json(
        { error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const trim = input.trimId
      ? vehicle.trims.find((t) => t.id === input.trimId)
      : vehicle.trims.find((t) => t.isDefault) ?? vehicle.trims[0];

    if (!trim) {
      return NextResponse.json(
        { error: "트림을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 선택된 옵션 가격 합산 (TrimOption 기반) + 추천 구성 추가금
    const selectedOptionIds = new Set(input.selectedOptionIds ?? []);
    const trimOptionsTotalPrice = trim.options
      .filter((o) => selectedOptionIds.has(o.id))
      .reduce((sum, o) => sum + o.price, 0);
    const optionsTotalPrice = trimOptionsTotalPrice + (input.extraOptionsPrice ?? 0);

    // 2) 회수율 데이터 + 순위 가산 설정 동시 조회
    const [rateSheets, rankSurcharges] = await Promise.all([
      (prisma as any).capitalRateSheet.findMany({
        where: { trimId: trim.id, isActive: true, financeCompany: { isActive: true } },
        include: { financeCompany: true },
      }),
      prisma.rankSurchargeConfig.findMany({ orderBy: { rank: "asc" } }),
    ]);

    if (rateSheets.length === 0) {
      return NextResponse.json(
        { error: "이 차량의 견적 데이터가 아직 준비되지 않았습니다." },
        { status: 404 }
      );
    }

    // 3) 데이터 매핑
    const configs: RateConfigData[] = rateSheets.map((rs: any) => ({
      financeCompanyId: rs.financeCompanyId,
      financeCompanyName: rs.financeCompany.name,
      financeSurchargeRate: rs.financeCompany.surchargeRate,
      minVehiclePrice: rs.minVehiclePrice,
      maxVehiclePrice: rs.maxVehiclePrice,
      minRateMatrix: rs.minRateMatrix,
      maxRateMatrix: rs.maxRateMatrix,
      depositDiscountRate: rs.depositDiscountRate,
      prepayAdjustRate: rs.prepayAdjustRate,
    }));

    // 순위 가산율: DB에 있으면 DB, 없으면 상수 fallback
    const rankRates = rankSurcharges.length > 0
      ? rankSurcharges.map((r) => r.rate)
      : [...RANK_SURCHARGE_RATES];

    // 4) 시나리오별 전체 파이프라인 실행
    const scenarioKeys = ["conservative", "standard", "aggressive"] as const;
    const scenarios: Record<string, {
      monthlyPayment: number;
      depositAmount: number;
      prepayAmount: number;
      contractMonths: number;
      annualMileage: number;
      contractType: string;
      bestFinanceCompany: string;
      purchaseSurcharge: number;
      breakdown: FinanceQuoteResult["breakdown"] | null;
      surcharges: FinanceQuoteResult["surcharges"] | null;
      allFinanceResults: {
        financeCompanyName: string;
        rank: number;
        monthlyPayment: number;
        baseMonthly: number;
        surcharges: FinanceQuoteResult["surcharges"];
      }[];
    }> = {};

    for (const key of scenarioKeys) {
      let depositRate: number = SCENARIO_CONDITIONS[key].depositRate;
      let prepayRate: number  = SCENARIO_CONDITIONS[key].prepayRate;
      if (key === "standard") {
        if (input.customDepositRate !== undefined) depositRate = input.customDepositRate;
        if (input.customPrepayRate  !== undefined) prepayRate  = input.customPrepayRate;
      }

      const calcInput: CalcInput = {
        vehiclePrice: trim.price + optionsTotalPrice,
        contractMonths: input.contractMonths,
        annualMileage: input.annualMileage,
        depositRate,
        prepayRate,
        vehicleSurchargeRate: vehicle.surchargeRate,
        rankSurchargeRates: rankRates,
        rateConfigs: configs,
      };

      const results = calculateMultiFinanceQuote(calcInput);

      if (results.length === 0) {
        // 해당 조건에서 계산 불가 → 기본값
        scenarios[key] = {
          monthlyPayment: 0,
          depositAmount: 0,
          prepayAmount: 0,
          contractMonths: input.contractMonths,
          annualMileage: input.annualMileage,
          contractType: input.contractType,
          bestFinanceCompany: "",
          purchaseSurcharge: 0,
          breakdown: null,
          surcharges: null,
          allFinanceResults: [],
        };
        continue;
      }

      // 인수형: 잔존가치 상쇄를 위한 12% 가산 (전체 금융사 동일 적용)
      const purchaseFactor = input.contractType === "인수형" ? 1.12 : 1;

      // 1순위(최저가) 금융사 결과
      const best = results[0];
      const monthlyPayment = Math.round(best.monthlyPayment * purchaseFactor);
      // 차분으로 계산해야 segment 합 == monthlyPayment 보장 (단순 *0.12는 반올림 오차 발생)
      const purchaseSurcharge = input.contractType === "인수형"
        ? monthlyPayment - Math.round(best.monthlyPayment)
        : 0;

      scenarios[key] = {
        monthlyPayment,
        depositAmount: best.breakdown.depositAmount,
        prepayAmount: best.breakdown.prepayAmount,
        contractMonths: input.contractMonths,
        annualMileage: input.annualMileage,
        contractType: input.contractType,
        bestFinanceCompany: best.financeCompanyName,
        purchaseSurcharge,
        breakdown: best.breakdown,
        surcharges: best.surcharges,
        allFinanceResults: results.map((r) => ({
          financeCompanyName: r.financeCompanyName,
          rank: r.rank,
          monthlyPayment: Math.round(r.monthlyPayment * purchaseFactor),
          baseMonthly: r.baseMonthly,
          surcharges: r.surcharges,
        })),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        vehicleSlug: slug,
        trimId: trim.id,
        trimName: trim.name,
        trimPrice: trim.price,
        optionsTotalPrice,
        totalVehiclePrice: trim.price + optionsTotalPrice,
        contractMonths: input.contractMonths,
        annualMileage: input.annualMileage,
        contractType: input.contractType,
        customerType: input.customerType,
        scenarios,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "견적 계산 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
