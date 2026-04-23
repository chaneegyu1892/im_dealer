import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET /api/quote/[id] ─────────────────────────────────
// 저장된 견적 조회 (공유 URL용)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quote = await prisma.savedQuote.findUnique({
      where: { id },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "견적을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 만료 확인
    if (new Date() > quote.expiresAt) {
      return NextResponse.json(
        { error: "견적이 만료되었습니다. 새로 견적을 받아주세요." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: quote.id,
        vehicleId: quote.vehicleId,
        trimId: quote.trimId,
        contractMonths: quote.contractMonths,
        annualMileage: quote.annualMileage,
        depositRate: quote.depositRate,
        prepayRate: quote.prepayRate,
        contractType: quote.contractType,
        monthlyPayment: quote.monthlyPayment,
        totalCost: quote.totalCost,
        breakdown: quote.breakdown,
        createdAt: quote.createdAt.toISOString(),
        expiresAt: quote.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[GET /api/quote/[id]]", error);
    return NextResponse.json(
      { error: "견적 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
