import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  calculateMultiFinanceQuote,
  type CalcInput,
  type RateConfigData,
} from "@/lib/quote-calculator";
import { notifyNewQuote } from "@/lib/notify";
import type { RateSheetRaw } from "@/types/admin";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";

const SCENARIO_CONDITIONS = {
  conservative: { depositRate: 20, prepayRate: 0 },
  standard: { depositRate: 0, prepayRate: 0 },
  aggressive: { depositRate: 0, prepayRate: 30 },
} as const;

const saveQuoteSchema = z.object({
  sessionId: z.string().min(1),
  vehicleSlug: z.string().min(1),
  trimId: z.string().min(1),
  selectedOptionIds: z.array(z.string()).default([]),
  extraOptionsPrice: z.number().int().min(0).default(0),
  contractMonths: z.number().int().refine((v) => [36, 48, 60].includes(v)),
  annualMileage: z.number().int().refine((v) => [10000, 20000, 30000].includes(v)),
  contractType: z.enum(["인수형", "반납형"]),
  customerType: z.enum(["individual", "self_employed", "corporate", "nonprofit"]).default("individual"),
  productType: z.enum(["장기렌트", "리스"]).default("장기렌트"),
  scenarioType: z.enum(["conservative", "standard", "aggressive"]),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const body = await request.json();
    const input = saveQuoteSchema.parse(body);

    const vehicle = await prisma.vehicle.findUnique({
      where: { slug: input.vehicleSlug },
      include: {
        trims: {
          where: { isVisible: true },
          include: { options: { select: { id: true, price: true, name: true } } },
        },
      },
    });

    if (!vehicle || !vehicle.isVisible) {
      return NextResponse.json(
        { error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const trim = vehicle.trims.find((t) => t.id === input.trimId);
    if (!trim) {
      return NextResponse.json(
        { error: "선택한 트림이 차량에 속하지 않습니다." },
        { status: 400 }
      );
    }

    const selectedOptionIds = new Set(input.selectedOptionIds);
    const selectedOptions = trim.options.filter((o) => selectedOptionIds.has(o.id));
    const trimOptionsTotalPrice = selectedOptions.reduce((sum, o) => sum + o.price, 0);
    const optionsTotalPrice = trimOptionsTotalPrice + input.extraOptionsPrice;
    const totalVehiclePrice = trim.price + optionsTotalPrice;

    const [rateSheets, rankSurcharges] = await Promise.all([
      prisma.capitalRateSheet.findMany({
        where: {
          trimId: trim.id,
          isActive: true,
          financeCompany: { isActive: true },
        },
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
    const condition = SCENARIO_CONDITIONS[input.scenarioType];

    const calcInput: CalcInput = {
      vehiclePrice: totalVehiclePrice,
      contractMonths: input.contractMonths,
      annualMileage: input.annualMileage,
      depositRate: condition.depositRate,
      prepayRate: condition.prepayRate,
      vehicleSurchargeRate: vehicle.surchargeRate,
      rankSurchargeRates: rankRates,
      rateConfigs: configs,
    };

    const results = calculateMultiFinanceQuote(calcInput);
    const best = results[0];
    if (!best) {
      return NextResponse.json(
        { error: "견적을 저장할 수 없습니다." },
        { status: 422 }
      );
    }

    const purchaseSurcharge =
      input.contractType === "인수형" ? Math.round(best.monthlyPayment * 0.12) : 0;
    const monthlyPayment = best.monthlyPayment + purchaseSurcharge;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    const breakdown = JSON.parse(JSON.stringify({
      scenarioType: input.scenarioType,
      productType: input.productType,
      customerType: input.customerType,
      vehicleSlug: input.vehicleSlug,
      vehicleName: vehicle.name,
      vehicleBrand: vehicle.brand,
      trimName: trim.name,
      trimPrice: trim.price,
      selectedOptions: selectedOptions.map((o) => ({
        id: o.id,
        name: o.name,
        price: o.price,
      })),
      optionsTotalPrice,
      totalVehiclePrice,
      bestFinanceCompany: best.financeCompanyName,
      purchaseSurcharge,
      quoteBreakdown: best.breakdown,
      surcharges: best.surcharges,
      allFinanceResults: results.map((r) => {
        const rPurchase =
          input.contractType === "인수형" ? Math.round(r.monthlyPayment * 0.12) : 0;
        return {
          financeCompanyName: r.financeCompanyName,
          rank: r.rank,
          monthlyPayment: r.monthlyPayment + rPurchase,
          baseMonthly: r.baseMonthly,
          surcharges: r.surcharges,
        };
      }),
    })) as Prisma.InputJsonObject;

    const existing = await prisma.savedQuote.findFirst({
      where: { sessionId: input.sessionId },
      orderBy: { createdAt: "desc" },
    });

    const data = {
      sessionId: input.sessionId,
      userId: user?.id ?? null,
      vehicleId: vehicle.id,
      trimId: trim.id,
      contractMonths: input.contractMonths,
      annualMileage: input.annualMileage,
      depositRate: condition.depositRate,
      prepayRate: condition.prepayRate,
      contractType: input.contractType,
      customerType: input.customerType,
      monthlyPayment,
      totalCost: monthlyPayment * input.contractMonths,
      breakdown,
      expiresAt,
    };

    const savedQuote = existing
      ? await prisma.savedQuote.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.savedQuote.create({
          data,
        });

    await prisma.quoteCalcLog.updateMany({
      where: {
        sessionId: input.sessionId,
        vehicleSlug: input.vehicleSlug,
      },
      data: { clickedApply: true },
    });

    // 운영자 Slack 알림 (실패해도 응답에 영향 없음)
    void notifyNewQuote({
      quoteId: savedQuote.id,
      vehicleName: vehicle.name,
      trimName: trim.name,
      monthlyPayment: savedQuote.monthlyPayment,
      contractMonths: savedQuote.contractMonths,
      userId: savedQuote.userId,
    });

    return NextResponse.json({
      success: true,
      data: { id: savedQuote.id, sessionId: savedQuote.sessionId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("[POST /api/quote/save]", error);
    return NextResponse.json(
      { error: "견적 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
