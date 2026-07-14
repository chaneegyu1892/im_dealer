import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  calculateMultiFinanceQuote,
  type RateConfigData,
  type CalcInput,
} from "@/lib/quote-calculator";
import type { FinanceQuoteResult } from "@/types/quote";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import { normalizeSelectedOptions } from "@/lib/option-rules";
import { lockQuoteScenario } from "@/lib/member-gate";
import { hashIp, getClientIp } from "@/lib/ip-hash";
import { apiRateLimit, checkRateLimit } from "@/lib/rate-limit";

const quoteSchema = z.object({
  // 견적 페이지에서만 전달 — 있으면 조회/계산 로그를 세션 기준으로 적재한다(비교 기능 등은 미전달).
  sessionId: z.string().min(1).optional(),
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
  exteriorColorId: z.string().nullable().optional(),
  interiorColorId: z.string().nullable().optional(),
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

    const limited = await checkRateLimit(request, apiRateLimit);
    if (limited) return limited;

    const body = await request.json();
    const input = quoteSchema.parse(body);

    // 0) 회원 여부 확인 — 보증금/선납금으로 낮아진 월납입금은 회원 전용.
    //    비회원에게는 (1) 커스텀 보증/선납 비율을 무시하고 (2) 보증금형·선납형
    //    시나리오를 잠가, 낮아진 금액이 응답 JSON 에 애초에 실리지 않게 한다(보안 경계).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isMember = !!user;

    // 1) 차량 + 트림 조회
    const vehicle = await prisma.vehicle.findUnique({
      where: { slug },
      include: {
        trims: {
          where: { isVisible: true },
          orderBy: { isDefault: "desc" },
          include: {
            options: { select: { id: true, name: true, price: true } },
            rules: {
              select: {
                ruleType: true,
                sourceOptionId: true,
                targetOptionId: true,
              },
            },
          },
        },
        colors: {
          select: { id: true, kind: true, priceDelta: true },
        },
      },
    });

    if (!vehicle || !vehicle.isVisible) {
      return NextResponse.json(
        { error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!input.trimId && vehicle.trims.length > 0) {
      return NextResponse.json(
        { error: "트림을 선택해 주세요." },
        { status: 400 }
      );
    }

    const trim = input.trimId
      ? vehicle.trims.find((t) => t.id === input.trimId)
      : undefined;

    if (input.trimId && !trim) {
      return NextResponse.json(
        { error: "선택한 트림이 차량에 속하지 않습니다." },
        { status: 400 }
      );
    }

    if (!trim) {
      return NextResponse.json({
        success: true,
        data: {
          vehicleSlug: slug,
          trimId: "",
          trimName: "",
          trimPrice: vehicle.basePrice,
          discountPrice: null,
          discountAmount: 0,
          optionsTotalPrice: 0,
          colorDelta: 0,
          totalVehiclePrice: vehicle.basePrice,
          contractMonths: input.contractMonths,
          annualMileage: input.annualMileage,
          contractType: input.contractType,
          customerType: input.customerType,
          scenarios: {} as Record<string, never>,
          requiresConsultation: true,
        },
      });
    }

    // 선택된 옵션을 규칙(REQUIRED/INCLUDED/CONFLICT) 기준으로 검증·정규화
    const { normalized: selectedOptionIds, conflicts } = normalizeSelectedOptions(
      input.selectedOptionIds ?? [],
      trim.rules,
    );

    if (conflicts.length > 0) {
      const optMap = new Map(trim.options.map((o) => [o.id, o.name]));
      const pairs = conflicts
        .map(
          (c) =>
            `${optMap.get(c.sourceOptionId) ?? c.sourceOptionId} ↔ ${optMap.get(c.targetOptionId) ?? c.targetOptionId}`,
        )
        .join(", ");
      return NextResponse.json(
        { error: `함께 선택할 수 없는 옵션 조합입니다: ${pairs}` },
        { status: 400 },
      );
    }

    // 정규화된 옵션 집합으로 가격 합산 (REQUIRED/INCLUDED 자동 포함분 반영)
    const trimOptionsTotalPrice = trim.options
      .filter((o) => selectedOptionIds.has(o.id))
      .reduce((sum, o) => sum + o.price, 0);
    const optionsTotalPrice = trimOptionsTotalPrice + (input.extraOptionsPrice ?? 0);

    // 색상 priceDelta (kind 일치 검증)
    const exteriorColor = input.exteriorColorId
      ? vehicle.colors.find((c) => c.id === input.exteriorColorId && c.kind === "EXTERIOR")
      : null;
    const interiorColor = input.interiorColorId
      ? vehicle.colors.find((c) => c.id === input.interiorColorId && c.kind === "INTERIOR")
      : null;
    const colorDelta = (exteriorColor?.priceDelta ?? 0) + (interiorColor?.priceDelta ?? 0);

    // 할인가: discountPrice 있으면 그것을 차량가 기준으로 사용
    const effectiveTrimPrice = trim.discountPrice ?? trim.price;
    const discountAmount = trim.discountPrice ? trim.price - trim.discountPrice : 0;

    // 2) 회수율 데이터 + 순위 가산 설정 동시 조회
    const [rateSheets, rankSurcharges] = await Promise.all([
      (prisma as any).capitalRateSheet.findMany({
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
      // 해당 트림(라인업)의 회수율 시트가 1건도 등록되지 않은 경우 → "별도 상담 필요" 분기.
      // 자동 견적은 불가하지만 차량/트림 메타정보는 그대로 반환하여 프론트가 안내 카드를 렌더링할 수 있게 함.
      return NextResponse.json({
        success: true,
        data: {
          vehicleSlug: slug,
          trimId: trim.id,
          trimName: trim.name,
          trimPrice: trim.price,
          discountPrice: trim.discountPrice ?? null,
          discountAmount,
          optionsTotalPrice,
          colorDelta,
          totalVehiclePrice: effectiveTrimPrice + optionsTotalPrice + colorDelta,
          contractMonths: input.contractMonths,
          annualMileage: input.annualMileage,
          contractType: input.contractType,
          customerType: input.customerType,
          scenarios: {} as Record<string, never>,
          requiresConsultation: true,
        },
      });
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
    // standard 시나리오에 실제 적용된 보증/선납 비율 — 계산 로그 기록에 사용.
    let stdDeposit = 0;
    let stdPrepay = 0;
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
      rangeExceeded: boolean;
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
      // 커스텀 보증/선납 비율은 회원만 적용. 비회원이 직접 customDepositRate 등을
      // 실어 보내도 무시해 standard 가 기본(무보증) 값으로 유지되게 한다(우회 차단).
      if (key === "standard" && isMember) {
        if (input.customDepositRate !== undefined) depositRate = input.customDepositRate;
        if (input.customPrepayRate  !== undefined) prepayRate  = input.customPrepayRate;
      }
      if (key === "standard") {
        stdDeposit = depositRate;
        stdPrepay = prepayRate;
      }

      const calcInput: CalcInput = {
        vehiclePrice: effectiveTrimPrice + optionsTotalPrice + colorDelta,
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
          rangeExceeded: false,
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
        rangeExceeded: best.rangeExceeded,
        allFinanceResults: results.map((r) => ({
          financeCompanyName: r.financeCompanyName,
          rank: r.rank,
          monthlyPayment: Math.round(r.monthlyPayment * purchaseFactor),
          baseMonthly: r.baseMonthly,
          surcharges: r.surcharges,
        })),
      };
    }

    // 비회원: 보증금형(conservative)·선납형(aggressive)을 잠가 낮아진 금액을 응답에서 제거.
    // standard(무보증)는 회원·비회원 모두 그대로 노출한다.
    const gatedScenarios = isMember
      ? scenarios
      : {
          ...scenarios,
          conservative: lockQuoteScenario(scenarios.conservative),
          aggressive: lockQuoteScenario(scenarios.aggressive),
        };

    // ── 로그 적재: 견적 조회(ExplorationLog) + 계산 로그(QuoteCalcLog) ──
    // sessionId 가 실린 경우(견적 페이지)만 기록. 세션×차량 기준 1건으로 dedup 하여
    // 슬라이더 재계산 등 반복 호출이 카운트를 부풀리지 않게 한다.
    if (input.sessionId) {
      const sessionId = input.sessionId;
      const std = scenarios.standard;
      const userAgent = request.headers.get("user-agent") ?? undefined;
      const ipHash = hashIp(getClientIp(request));
      try {
        // QuoteCalcLog: 세션×차량 1행 유지 — 있으면 최신 조건/결과로 갱신, 없으면 생성.
        const calcData = {
          userId: user?.id ?? null,
          vehicleId: vehicle.id,
          vehicleSlug: slug,
          vehicleName: vehicle.name,
          trimId: trim.id,
          optionIds: [...selectedOptionIds],
          contractMonths: input.contractMonths,
          annualMileage: input.annualMileage,
          depositRate: stdDeposit,
          prepayRate: stdPrepay,
          contractType: input.contractType,
          productType: input.productType,
          resultMonthly: std?.monthlyPayment ?? 0,
          bestFinanceCompany: std?.bestFinanceCompany ?? "",
          scenarioType: "standard",
          rangeExceeded: std?.rangeExceeded ?? false,
          deviceType: /Mobile|Android|iPhone/i.test(userAgent ?? "") ? "mobile" : "desktop",
          referrer: request.headers.get("referer") ?? undefined,
          userAgent,
          ipHash,
        };
        const updated = await prisma.quoteCalcLog.updateMany({
          where: { sessionId, vehicleSlug: slug },
          data: calcData,
        });
        if (updated.count === 0) {
          await prisma.quoteCalcLog.create({ data: { sessionId, ...calcData } });
        }

        // ExplorationLog(quote_start): 세션×차량 최초 1건만 — 대시보드/분석 "견적 조회" 소스.
        const existingView = await prisma.explorationLog.findFirst({
          where: { sessionId, vehicleId: vehicle.id, eventType: "quote_start" },
          select: { id: true },
        });
        if (!existingView) {
          await prisma.explorationLog.create({
            data: {
              sessionId,
              eventType: "quote_start",
              path: `/quote?vehicle=${slug}`,
              vehicleId: vehicle.id,
              metadata: {
                contractMonths: input.contractMonths,
                annualMileage: input.annualMileage,
              },
              userAgent,
              ipHash,
            },
          });
        }
      } catch (err) {
        // 로그 적재 실패는 견적 응답에 영향 주지 않는다.
        console.error("[vehicles/:slug/quote] 로그 적재 실패:", err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        vehicleSlug: slug,
        trimId: trim.id,
        trimName: trim.name,
        trimPrice: trim.price,
        discountPrice: trim.discountPrice ?? null,
        discountAmount,
        optionsTotalPrice,
        colorDelta,
        totalVehiclePrice: effectiveTrimPrice + optionsTotalPrice + colorDelta,
        contractMonths: input.contractMonths,
        annualMileage: input.annualMileage,
        contractType: input.contractType,
        customerType: input.customerType,
        scenarios: gatedScenarios,
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
