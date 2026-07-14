import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  calculateMultiFinanceQuote,
  type CalcInput,
  type RateConfigData,
} from "@/lib/quote-calculator";
import type { RateSheetRaw } from "@/types/admin";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import { createAdminNotification } from "@/lib/admin-notification";
import { saveQuoteSchema } from "./request-schema";
import { PUBLIC_TRIM_WHERE } from "@/lib/vehicle-visibility-policy";

const SCENARIO_CONDITIONS = {
  conservative: { depositRate: 20, prepayRate: 0 },
  standard: { depositRate: 0, prepayRate: 0 },
  aggressive: { depositRate: 0, prepayRate: 30 },
} as const;

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
          where: PUBLIC_TRIM_WHERE,
          include: { options: { select: { id: true, price: true, name: true } } },
        },
        colors: {
          select: { id: true, kind: true, name: true, hexCode: true, priceDelta: true },
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

    // 색상 검증 — 선택된 색상이 차량 소속인지, kind가 맞는지 확인
    const exteriorColor = input.exteriorColorId
      ? vehicle.colors.find((c) => c.id === input.exteriorColorId && c.kind === "EXTERIOR") ?? null
      : null;
    const interiorColor = input.interiorColorId
      ? vehicle.colors.find((c) => c.id === input.interiorColorId && c.kind === "INTERIOR") ?? null
      : null;
    if (input.exteriorColorId && !exteriorColor) {
      return NextResponse.json(
        { error: "선택한 외장 색상이 차량과 일치하지 않습니다." },
        { status: 400 }
      );
    }
    if (input.interiorColorId && !interiorColor) {
      return NextResponse.json(
        { error: "선택한 내장 색상이 차량과 일치하지 않습니다." },
        { status: 400 }
      );
    }
    const colorDelta = (exteriorColor?.priceDelta ?? 0) + (interiorColor?.priceDelta ?? 0);

    // 할인가: discountPrice 있으면 그것을 차량가 기준으로 사용
    const effectiveTrimPrice = trim.discountPrice ?? trim.price;
    const totalVehiclePrice = effectiveTrimPrice + optionsTotalPrice + colorDelta;
    const condition = input.customDepositRate !== undefined || input.customPrepayRate !== undefined
      ? {
          depositRate: input.customDepositRate ?? 0,
          prepayRate: input.customPrepayRate ?? 0,
        }
      : SCENARIO_CONDITIONS[input.scenarioType];
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    const existing = await prisma.savedQuote.findUnique({
      where: { sessionId: input.sessionId },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
        status: true,
        pricingStatus: true,
      },
    });

    if (existing?.deletedAt) {
      return NextResponse.json({ error: "삭제된 견적입니다." }, { status: 410 });
    }
    if (existing?.userId && existing.userId !== user?.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }
    if (existing && existing.status !== "NEW") {
      return NextResponse.json({
        success: true,
        data: {
          id: existing.id,
          sessionId: input.sessionId,
          requiresConsultation: existing.pricingStatus === "CONSULTATION_REQUIRED",
        },
      });
    }

    const [rateSheets, rankSurcharges] = await Promise.all([
      prisma.capitalRateSheet.findMany({
        where: {
          trimId: trim.id,
          productType: input.productType,
          isActive: true,
          financeCompany: { isActive: true },
        },
        include: { financeCompany: true },
      }),
      prisma.rankSurchargeConfig.findMany({ orderBy: { rank: "asc" } }),
    ]);

    if (rateSheets.length === 0) {
      const breakdown = JSON.parse(JSON.stringify({
        scenarioType: input.scenarioType,
        productType: input.productType,
        customerType: input.customerType,
        vehicleSlug: input.vehicleSlug,
        vehicleName: vehicle.name,
        vehicleBrand: vehicle.brand,
        trimName: trim.name,
        trimPrice: trim.price,
        selectedOptions: selectedOptions.map((option) => ({
          id: option.id,
          name: option.name,
          price: option.price,
        })),
        exteriorColor: exteriorColor
          ? { id: exteriorColor.id, name: exteriorColor.name, hexCode: exteriorColor.hexCode, priceDelta: exteriorColor.priceDelta }
          : null,
        interiorColor: interiorColor
          ? { id: interiorColor.id, name: interiorColor.name, hexCode: interiorColor.hexCode, priceDelta: interiorColor.priceDelta }
          : null,
        colorDelta,
        optionsTotalPrice,
        totalVehiclePrice,
        contractMonths: input.contractMonths,
        annualMileage: input.annualMileage,
        contractType: input.contractType,
        depositRate: condition.depositRate,
        prepayRate: condition.prepayRate,
        requiresConsultation: true,
        consultationReason: "RATE_SHEET_UNAVAILABLE",
      })) as Prisma.InputJsonObject;

      const data = {
        sessionId: input.sessionId,
        userId: user?.id ?? existing?.userId ?? null,
        vehicleId: vehicle.id,
        trimId: trim.id,
        contractMonths: input.contractMonths,
        annualMileage: input.annualMileage,
        depositRate: condition.depositRate,
        prepayRate: condition.prepayRate,
        contractType: input.contractType,
        customerType: input.customerType,
        quoteType: input.quoteType,
        monthlyPayment: 0,
        totalCost: 0,
        pricingStatus: "CONSULTATION_REQUIRED" as const,
        breakdown,
        expiresAt,
        exteriorColorId: exteriorColor?.id ?? null,
        interiorColorId: interiorColor?.id ?? null,
      };

      const savedQuote = await prisma.savedQuote.upsert({
        where: { sessionId: input.sessionId },
        create: data,
        update: existing ? data : {},
      });

      if (!existing) {
        await createAdminNotification({
          type: "NEW_QUOTE",
          title: "별도 상담 견적 요청",
          content: `${vehicle.name} ${trim.name} · ${input.productType} · 별도 상담 필요`,
          linkUrl: `/admin/quotations?id=${savedQuote.id}`,
        }).catch((notificationError) => {
          console.error("[POST /api/quote/save] consultation notification", notificationError);
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: savedQuote.id,
          sessionId: savedQuote.sessionId,
          requiresConsultation: true,
        },
      });
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
      exteriorColor: exteriorColor
        ? { id: exteriorColor.id, name: exteriorColor.name, hexCode: exteriorColor.hexCode, priceDelta: exteriorColor.priceDelta }
        : null,
      interiorColor: interiorColor
        ? { id: interiorColor.id, name: interiorColor.name, hexCode: interiorColor.hexCode, priceDelta: interiorColor.priceDelta }
        : null,
      colorDelta,
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

    const data = {
      sessionId: input.sessionId,
      userId: user?.id ?? existing?.userId ?? null,
      vehicleId: vehicle.id,
      trimId: trim.id,
      contractMonths: input.contractMonths,
      annualMileage: input.annualMileage,
      depositRate: condition.depositRate,
      prepayRate: condition.prepayRate,
      contractType: input.contractType,
      customerType: input.customerType,
      quoteType: input.quoteType,
      monthlyPayment,
      totalCost: monthlyPayment * input.contractMonths,
      pricingStatus: "CALCULATED" as const,
      breakdown,
      expiresAt,
      exteriorColorId: exteriorColor?.id ?? null,
      interiorColorId: interiorColor?.id ?? null,
    };

    const savedQuote = await prisma.savedQuote.upsert({
      where: { sessionId: input.sessionId },
      create: data,
      update: existing ? data : {},
    });

    await prisma.quoteCalcLog.updateMany({
      where: {
        sessionId: input.sessionId,
        vehicleSlug: input.vehicleSlug,
      },
      data: { clickedApply: true },
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
    Sentry.captureException(error, { tags: { route: "quote/save" } });
    return NextResponse.json(
      { error: "견적 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
