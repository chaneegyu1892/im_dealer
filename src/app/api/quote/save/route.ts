import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/require-user";
import {
  calculateMultiFinanceQuote,
  type CalcInput,
  type RateConfigData,
} from "@/lib/quote-calculator";
import type { RateSheetRaw } from "@/types/admin";
import { INHERITANCE_SURCHARGE_RATE, RANK_SURCHARGE_RATES, SCENARIO_CONDITIONS } from "@/constants/quote-defaults";
import { productTypeLabel } from "@/constants/product-type";
import { createAdminNotification } from "@/lib/admin-notification";
import { buildScenarioSnapshots } from "@/lib/quote-scenario-snapshots";
import { saveQuoteSchema } from "./request-schema";
import { PUBLIC_TRIM_WHERE } from "@/lib/vehicle-visibility-policy";
import { resolveQuoteContact } from "@/lib/quote-contact";
import { normalizeSelectedOptions } from "@/lib/option-rules";
import { toSavedQuoteClientData } from "@/lib/saved-quote-client";
import {
  createVerificationCapability,
  hashVerificationCapability,
  matchesVerificationCapability,
  VERIFICATION_CAPABILITY_COOKIE_PATH,
  VERIFICATION_CAPABILITY_MAX_AGE_SECONDS,
  verificationCapabilityCookieName,
} from "@/lib/verification-capability";
import { checkRateLimit, quoteSaveRateLimit } from "@/lib/rate-limit";

function attachVerificationCapability<T>(
  response: NextResponse<T>,
  sessionId: string,
  capability: string | null
): NextResponse<T> {
  if (!capability) return response;
  response.cookies.set({
    name: verificationCapabilityCookieName(sessionId),
    value: capability,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: VERIFICATION_CAPABILITY_COOKIE_PATH,
    maxAge: VERIFICATION_CAPABILITY_MAX_AGE_SECONDS,
  });
  return response;
}

type SavedQuoteAccessRow = {
  userId: string | null;
  deletedAt: Date | null;
  verificationCapabilityHash?: string | null;
};

async function denySavedQuoteAccess(
  existing: SavedQuoteAccessRow,
  callerSupabaseId: string | null | undefined,
  sessionId: string,
): Promise<NextResponse | null> {
  if (existing.deletedAt) {
    return NextResponse.json({ error: "삭제된 견적입니다." }, { status: 410 });
  }
  if (existing.userId && existing.userId !== callerSupabaseId) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }
  if (existing.userId === null) {
    const capability = (await cookies())
      .get(verificationCapabilityCookieName(sessionId))
      ?.value;
    if (!capability || !matchesVerificationCapability(existing.verificationCapabilityHash, capability)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, quoteSaveRateLimit, "quote-save");
  if (limited) return limited;

  const user = await getActiveUser();
  let sessionId: string | null = null;

  try {
    const body = await request.json();
    const input = saveQuoteSchema.parse(body);
    sessionId = input.sessionId;

    const vehicle = await prisma.vehicle.findUnique({
      where: { slug: input.vehicleSlug },
      include: {
        trims: {
          where: PUBLIC_TRIM_WHERE,
          include: {
            options: { select: { id: true, price: true, name: true } },
            rules: {
              select: { ruleType: true, sourceOptionId: true, targetOptionId: true },
            },
          },
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

    const existing = await prisma.savedQuote.findUnique({
      where: { sessionId: input.sessionId },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
        status: true,
        pricingStatus: true,
        monthlyPayment: true,
        totalCost: true,
        depositRate: true,
        prepayRate: true,
        breakdown: true,
        customerName: true,
        phone: true,
        verificationCapabilityHash: true,
      },
    });

    if (existing) {
      const denied = await denySavedQuoteAccess(existing, user?.supabaseId, input.sessionId);
      if (denied) return denied;
    }

    const activeUserId = user?.supabaseId ?? null;
    let issuedVerificationCapability: string | null = null;
    let verificationCapabilityHash: string | null = null;

    if (existing?.userId === null) {
      verificationCapabilityHash = activeUserId ? null : existing.verificationCapabilityHash;
    } else if (!existing && !activeUserId) {
      issuedVerificationCapability = createVerificationCapability();
      verificationCapabilityHash = hashVerificationCapability(issuedVerificationCapability);
    }

    const quoteOwnerId = activeUserId ?? existing?.userId ?? null;
    if (existing && existing.status !== "NEW") {
      return attachVerificationCapability(NextResponse.json({
        success: true,
        data: toSavedQuoteClientData({
          id: existing.id,
          sessionId: input.sessionId,
          monthlyPayment: existing.monthlyPayment,
          totalCost: existing.totalCost,
          pricingStatus: existing.pricingStatus,
          depositRate: existing.depositRate,
          prepayRate: existing.prepayRate,
          breakdown: existing.breakdown,
        }),
      }), input.sessionId, issuedVerificationCapability);
    }

    const { normalized: selectedOptionIds, conflicts } = normalizeSelectedOptions(
      input.selectedOptionIds,
      trim.rules ?? [],
    );
    if (conflicts.length > 0) {
      const optMap = new Map(trim.options.map((option) => [option.id, option.name]));
      const pairs = conflicts
        .map(
          (conflict) =>
            `${optMap.get(conflict.sourceOptionId) ?? conflict.sourceOptionId} ↔ ${optMap.get(conflict.targetOptionId) ?? conflict.targetOptionId}`,
        )
        .join(", ");
      return NextResponse.json(
        { error: `함께 선택할 수 없는 옵션 조합입니다: ${pairs}` },
        { status: 400 }
      );
    }
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
    // 커스텀 보증/선납 요율은 회원 전용. 비회원 저장은 타입을 standard 로 고정하되
    // 실제 비율은 공개 조건(선납 30%)을 담는다 — 표시 API와 같은 게스트 정책.
    const isMember = !!user;
    const effectiveScenarioType = isMember ? input.scenarioType : "standard";
    const hasCustomRates =
      isMember &&
      (input.customDepositRate !== undefined || input.customPrepayRate !== undefined);
    const condition = isMember
      ? hasCustomRates
        ? {
            depositRate: input.customDepositRate ?? 0,
            prepayRate: input.customPrepayRate ?? 0,
          }
        : SCENARIO_CONDITIONS[effectiveScenarioType]
      : SCENARIO_CONDITIONS.aggressive;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    const contact = resolveQuoteContact({
      quoteName: existing?.customerName,
      quotePhone: existing?.phone,
      memberName: user?.name,
      memberPhone: user?.phone,
    });

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
        scenarioType: effectiveScenarioType,
        productType: input.productType,
        customerType: input.customerType,
        vehicleSlug: input.vehicleSlug,
        vehicleName: vehicle.name,
        vehicleBrand: vehicle.brand,
        trimName: trim.name,
        trimPrice: trim.price,
        discountPrice: trim.discountPrice,
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
        userId: quoteOwnerId,
        verificationCapabilityHash,
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
        customerName: contact.customerName,
        phone: contact.phone,
        exteriorColorId: exteriorColor?.id ?? null,
        interiorColorId: interiorColor?.id ?? null,
      };

      const [savedQuote] = await prisma.$transaction([
        prisma.savedQuote.upsert({
          where: { sessionId: input.sessionId },
          create: data,
          update: existing ? data : {},
        }),
        prisma.quoteCalcLog.updateMany({
          where: {
            sessionId: input.sessionId,
            vehicleSlug: input.vehicleSlug,
          },
          data: { clickedApply: true },
        }),
      ]);

      if (!existing) {
        await createAdminNotification({
          type: "NEW_QUOTE",
          title: "별도 상담 견적 요청",
          content: `${vehicle.name} ${trim.name} · ${productTypeLabel(input.productType)} · 별도 상담 필요`,
          linkUrl: `/admin/quotations?id=${savedQuote.id}`,
        }).catch((notificationError) => {
          console.error("[POST /api/quote/save] consultation notification", notificationError);
        });
      }

      return attachVerificationCapability(NextResponse.json({
        success: true,
        data: toSavedQuoteClientData({
          id: savedQuote.id,
          sessionId: savedQuote.sessionId,
          monthlyPayment: 0,
          totalCost: 0,
          pricingStatus: "CONSULTATION_REQUIRED",
          depositRate: condition.depositRate,
          prepayRate: condition.prepayRate,
          breakdown,
        }),
      }), input.sessionId, issuedVerificationCapability);
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
      input.contractType === "인수형" ? Math.round(best.monthlyPayment * INHERITANCE_SURCHARGE_RATE) : 0;
    const monthlyPayment = best.monthlyPayment + purchaseSurcharge;

    // 재발급 견적서의 시나리오 비교 표까지 저장 시점 값으로 재현되도록 3종 스냅샷을 남긴다.
    const scenarioSnapshots = buildScenarioSnapshots({
      vehiclePrice: totalVehiclePrice,
      contractMonths: input.contractMonths,
      annualMileage: input.annualMileage,
      vehicleSurchargeRate: vehicle.surchargeRate,
      rankSurchargeRates: rankRates,
      rateConfigs: configs,
      contractType: input.contractType,
    });

    const breakdown = JSON.parse(JSON.stringify({
      scenarioType: effectiveScenarioType,
      productType: input.productType,
      customerType: input.customerType,
      vehicleSlug: input.vehicleSlug,
      vehicleName: vehicle.name,
      vehicleBrand: vehicle.brand,
      trimName: trim.name,
      trimPrice: trim.price,
      discountPrice: trim.discountPrice,
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
      scenarioSnapshots,
      quoteBreakdown: best.breakdown,
      surcharges: best.surcharges,
      allFinanceResults: results.map((r) => {
        const rPurchase =
          input.contractType === "인수형" ? Math.round(r.monthlyPayment * INHERITANCE_SURCHARGE_RATE) : 0;
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
      userId: quoteOwnerId,
      verificationCapabilityHash,
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
      customerName: contact.customerName,
      phone: contact.phone,
      exteriorColorId: exteriorColor?.id ?? null,
      interiorColorId: interiorColor?.id ?? null,
    };

    const [savedQuote] = await prisma.$transaction([
      prisma.savedQuote.upsert({
        where: { sessionId: input.sessionId },
        create: data,
        update: existing ? data : {},
      }),
      prisma.quoteCalcLog.updateMany({
        where: {
          sessionId: input.sessionId,
          vehicleSlug: input.vehicleSlug,
        },
        data: { clickedApply: true },
      }),
    ]);

    return attachVerificationCapability(NextResponse.json({
      success: true,
      data: toSavedQuoteClientData({
        id: savedQuote.id,
        sessionId: savedQuote.sessionId,
        monthlyPayment,
        totalCost: monthlyPayment * input.contractMonths,
        pricingStatus: "CALCULATED",
        depositRate: condition.depositRate,
        prepayRate: condition.prepayRate,
        breakdown,
        bestFinanceCompany: best.financeCompanyName,
      }),
    }), input.sessionId, issuedVerificationCapability);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: error.flatten() },
        { status: 400 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingQuote = sessionId
        ? await prisma.savedQuote.findUnique({
            where: { sessionId },
            select: {
              id: true,
              sessionId: true,
              userId: true,
              deletedAt: true,
              status: true,
              monthlyPayment: true,
              totalCost: true,
              pricingStatus: true,
              depositRate: true,
              prepayRate: true,
              breakdown: true,
              verificationCapabilityHash: true,
            },
          })
        : null;
      if (existingQuote && sessionId) {
        const denied = await denySavedQuoteAccess(existingQuote, user?.supabaseId, sessionId);
        if (denied) return denied;
        return NextResponse.json({
          success: true,
          data: toSavedQuoteClientData(existingQuote),
        });
      }
    }
    console.error("[POST /api/quote/save]", error);
    Sentry.captureException(error, { tags: { route: "quote/save" } });
    return NextResponse.json(
      { error: "견적 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
