import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminNotification } from "@/lib/admin-notification";
import { isCustomerType } from "@/constants/customer-types";
import { z } from "zod";

// CRM 리드 저장 — 클라이언트 입력의 구조/타입을 검증해 크래시(문자열 monthlyPayment 등)와
// 이상 데이터(contractMonths 0/음수)를 차단한다.
// (클라이언트 금액 신뢰 제거를 위한 서버 재계산 통일은 verify 플로우 전반 정리와 함께 후속 작업.)
const quotesPostSchema = z.object({
  sessionId: z.string().min(1),
  vehicleId: z.string().min(1),
  trimId: z.string().min(1),
  contractMonths: z.number().int().positive(),
  annualMileage: z.number().int().positive(),
  depositRate: z.number().min(0),
  prepayRate: z.number().min(0),
  contractType: z.string(),
  customerType: z.string(),
  monthlyPayment: z.number().int().nonnegative(),
  totalCost: z.number().int().nonnegative(),
  breakdown: z.record(z.unknown()).optional(),
  customerName: z.string().optional(),
  phone: z.string().optional(),
  exteriorColorId: z.string().nullish(),
  interiorColorId: z.string().nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const parsed = quotesPostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      sessionId,
      vehicleId,
      trimId,
      contractMonths,
      annualMileage,
      depositRate,
      prepayRate,
      contractType,
      customerType,
      monthlyPayment,
      totalCost,
      breakdown,
      customerName,
      phone,
      exteriorColorId,
      interiorColorId,
    } = parsed.data;

    // vehicleId 필드로 기존 ID 또는 slug가 들어올 수 있어 저장 전 ID로 정규화
    let targetVehicleId = vehicleId;
    if (vehicleId) {
      const byId = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true },
      });
      if (!byId) {
        const bySlug = await prisma.vehicle.findUnique({
          where: { slug: vehicleId },
          select: { id: true },
        });
        if (bySlug) targetVehicleId = bySlug.id;
      }
    }

    // 옵션 가격 변동 대비를 위해 저장 시점의 옵션 스냅샷을 breakdown에 함께 저장.
    const breakdownInput =
      breakdown && typeof breakdown === "object" ? (breakdown as Record<string, unknown>) : {};
    const selectedOptionIdsRaw = breakdownInput.selectedOptionIds;
    const selectedOptionIds = Array.isArray(selectedOptionIdsRaw)
      ? selectedOptionIdsRaw.filter((id): id is string => typeof id === "string")
      : [];

    let selectedOptionsSnapshot: Array<{ id: string; name: string; price: number }> = [];
    if (selectedOptionIds.length > 0) {
      const options = await prisma.trimOption.findMany({
        where: { id: { in: selectedOptionIds } },
        select: { id: true, name: true, price: true },
      });
      selectedOptionsSnapshot = options.map((o) => ({ id: o.id, name: o.name, price: o.price }));
    }

    // 색상 검증 — vehicle 소속 + kind 일치
    let exteriorColorIdValid: string | null = null;
    let interiorColorIdValid: string | null = null;
    let exteriorColorSnapshot: { id: string; name: string; hexCode: string; priceDelta: number } | null = null;
    let interiorColorSnapshot: { id: string; name: string; hexCode: string; priceDelta: number } | null = null;
    if (targetVehicleId && (exteriorColorId || interiorColorId)) {
      const ids = [exteriorColorId, interiorColorId].filter(
        (v): v is string => typeof v === "string" && v.length > 0
      );
      if (ids.length > 0) {
        const fetched = await prisma.vehicleColor.findMany({
          where: { id: { in: ids }, vehicleId: targetVehicleId },
          select: { id: true, kind: true, name: true, hexCode: true, priceDelta: true },
        });
        const ext = fetched.find((c) => c.id === exteriorColorId && c.kind === "EXTERIOR");
        const intr = fetched.find((c) => c.id === interiorColorId && c.kind === "INTERIOR");
        if (ext) {
          exteriorColorIdValid = ext.id;
          exteriorColorSnapshot = { id: ext.id, name: ext.name, hexCode: ext.hexCode, priceDelta: ext.priceDelta };
        }
        if (intr) {
          interiorColorIdValid = intr.id;
          interiorColorSnapshot = { id: intr.id, name: intr.name, hexCode: intr.hexCode, priceDelta: intr.priceDelta };
        }
      }
    }

    const enrichedBreakdown = {
      ...breakdownInput,
      selectedOptions: selectedOptionsSnapshot,
      exteriorColor: exteriorColorSnapshot,
      interiorColor: interiorColorSnapshot,
    };

    // 1. 견적 저장
    const savedQuote = await prisma.savedQuote.create({
      data: {
        sessionId,
        userId: user?.id,
        vehicleId: targetVehicleId,
        trimId,
        contractMonths,
        annualMileage,
        depositRate,
        prepayRate,
        contractType,
        customerType: isCustomerType(customerType) ? customerType : "individual",
        monthlyPayment,
        totalCost,
        breakdown: enrichedBreakdown,
        customerName: customerName || "고객",
        phone: phone || "010-0000-0000",
        status: "NEW", // QuoteStatus.NEW
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후 만료
        exteriorColorId: exteriorColorIdValid,
        interiorColorId: interiorColorIdValid,
      },
    });

    // 2. 관리자 알림 생성
    await createAdminNotification({
      type: "NEW_QUOTE",
      title: "새로운 견적 신청",
      content: `${customerName || "고객"}님이 새로운 견적 상담을 신청했습니다. (${monthlyPayment.toLocaleString()}원/월)`,
      linkUrl: `/admin/quotations?id=${savedQuote.id}`,
    });

    return NextResponse.json({ success: true, data: savedQuote });
  } catch (error) {
    console.error("[POST /api/quotes]", error);
    return NextResponse.json(
      { error: "견적 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
