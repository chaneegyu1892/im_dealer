import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminNotification } from "@/lib/admin-notification";
import { isCustomerType } from "@/constants/customer-types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
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
    } = body;

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
        breakdown,
        customerName: customerName || "고객",
        phone: phone || "010-0000-0000",
        status: "NEW", // QuoteStatus.NEW
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후 만료
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
