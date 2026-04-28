import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashIp, getClientIp } from "@/lib/ip-hash";
import {
  calculateMultiFinanceQuote,
  type RateConfigData,
  type CalcInput,
} from "@/lib/quote-calculator";
import type { FinanceQuoteResult } from "@/types/quote";
import type { RateSheetRaw } from "@/types/admin";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";

const SCENARIO_CONDITIONS = {
  conservative: { depositRate: 20, prepayRate: 0 },
  standard: { depositRate: 0, prepayRate: 0 },
  aggressive: { depositRate: 0, prepayRate: 30 },
} as const;

const calculateSchema = z.object({
  sessionId: z.string().min(1).optional(),
  vehicleSlug: z.string().min(1),
  trimId: z.string().optional(),
  selectedOptionIds: z.array(z.string()).optional(),
  extraOptionsPrice: z.number().int().min(0).optional(),
  contractMonths: z.number().int().refine((v) => [36, 48, 60].includes(v)),
  annualMileage: z.number().int().refine((v) => [10000, 20000, 30000].includes(v)),
  contractType: z.enum(["인수형", "반납형"]),
  customerType: z.enum(["individual", "self_employed", "corporate", "nonprofit"]).default("individual"),
  productType: z.enum(["장기렌트", "리스"]).default("장기렌트"),
});

// ── POST /api/quote/calculate ────────────────────────────
// 독립 견적 계산 엔드포인트 (3개 시나리오 반환)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = calculateSchema.parse(body);

    // 1) 차량 + 트림 조회
    const vehicle = await prisma.vehicle.findUnique({
      where: { slug: input.vehicleSlug },
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

    // 옵션 가격 합산
    const selectedOptionIds = new Set(input.selectedOptionIds ?? []);
    const trimOptionsTotalPrice = trim.options
      .filter((o) => selectedOptionIds.has(o.id))
      .reduce((sum, o) => sum + o.price, 0);
    const optionsTotalPrice = trimOptionsTotalPrice + (input.extraOptionsPrice ?? 0);

    // 2) 회수율 데이터 + 순위 가산 동시 조회
    const [rateSheets, rankSurcharges] = await Promise.all([
      prisma.capitalRateSheet.findMany({
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
    const configs: RateConfigData[] = rateSheets.map((rs) => ({
      financeCompanyId: rs.financeCompanyId,
      financeCompanyName: rs.financeCompany.name,
      financeSurchargeRate: rs.financeCompany.surchargeRate,
      minVehiclePrice: rs.minVehiclePrice,
      maxVehiclePrice: rs.maxVehiclePrice,
      minRateMatrix: rs.minRateMatrix as RateSheetRaw,
      maxRateMatrix: rs.maxRateMatrix as RateSheetRaw,
      depositDiscountRate: rs.depositDiscountRate,
      prepayAdjustRate: rs.prepayAdjustRate,
    }));

    const rankRates = rankSurcharges.length > 0
      ? rankSurcharges.map((r) => r.rate)
      : [...RANK_SURCHARGE_RATES];

    // 4) 3개 시나리오별 계산
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
      const { depositRate, prepayRate } = SCENARIO_CONDITIONS[key];

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

      const isPurchase = input.contractType === "인수형";
      const best = results[0];
      const purchaseSurcharge = isPurchase ? Math.round(best.monthlyPayment * 0.12) : 0;
      const monthlyPayment = best.monthlyPayment + purchaseSurcharge;

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
        allFinanceResults: results.map((r) => {
          const rPurchase = isPurchase ? Math.round(r.monthlyPayment * 0.12) : 0;
          return {
            financeCompanyName: r.financeCompanyName,
            rank: r.rank,
            monthlyPayment: r.monthlyPayment + rPurchase,
            baseMonthly: r.baseMonthly,
            surcharges: r.surcharges,
          };
        }),
      };
    }

    // ── 견적 로그 비동기 저장 ──
    const ip = getClientIp(request);
    const ipHash = hashIp(ip);
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const logSessionId = input.sessionId ?? `anon-${Date.now()}`;

    Promise.all(
      Object.entries(scenarios).map(([scenarioType, sc]) =>
        prisma.quoteCalcLog.create({
          data: {
            sessionId: logSessionId,
            vehicleId: vehicle.id,
            vehicleSlug: input.vehicleSlug,
            trimId: trim.id,
            optionIds: input.selectedOptionIds ?? [],
            contractMonths: input.contractMonths,
            annualMileage: input.annualMileage,
            depositRate: SCENARIO_CONDITIONS[scenarioType as keyof typeof SCENARIO_CONDITIONS]?.depositRate ?? 0,
            prepayRate: SCENARIO_CONDITIONS[scenarioType as keyof typeof SCENARIO_CONDITIONS]?.prepayRate ?? 0,
            contractType: input.contractType,
            productType: input.productType,
            resultMonthly: sc.monthlyPayment,
            bestFinanceCompany: sc.bestFinanceCompany,
            scenarioType,
            deviceType: /Mobile|Android|iPhone/i.test(userAgent ?? "") ? "mobile" : "desktop",
            referrer: request.headers.get("referer") ?? undefined,
            userAgent,
            ipHash,
          },
        })
      )
    ).catch((err) => console.error("[QuoteCalcLog] 저장 실패:", err));

    return NextResponse.json({
      success: true,
      data: {
        vehicleSlug: input.vehicleSlug,
        vehicleName: vehicle.name,
        vehicleBrand: vehicle.brand,
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
    console.error("[POST /api/quote/calculate]", error);
    return NextResponse.json(
      { error: "견적 계산 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
