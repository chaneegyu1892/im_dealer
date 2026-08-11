import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/require-user";

// ── GET /api/quote/[id] ─────────────────────────────────
// 저장된 견적 조회 (공유 URL용)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quote = await prisma.savedQuote.findFirst({
      where: { id, deletedAt: null },
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
        customerType: quote.customerType,
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

// ── DELETE /api/quote/[id] ──────────────────────────────
// 본인 견적만 감사 로그와 함께 소프트 삭제한다.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getActiveUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const quote = await prisma.savedQuote.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, userId: true },
    });

    if (!quote) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!user.supabaseId || quote.userId !== user.supabaseId) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.savedQuote.updateMany({
        where: { id, userId: user.supabaseId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) return false;

      await tx.quoteActivityLog.create({
        data: {
          quoteId: id,
          actorId: user.id,
          action: "DELETED",
        },
      });
      return true;
    });

    if (!deleted) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/quote/[id]]", error);
    return NextResponse.json({ error: "견적 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
