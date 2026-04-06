import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET /api/logs/recommendation ────────────────────────
// 관리자용 AI 추천 로그 조회
// Query params: page, limit, from, to, industry, purpose
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const industry = searchParams.get("industry") ?? undefined;
    const purpose = searchParams.get("purpose") ?? undefined;
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "30")));
    const skip = (page - 1) * limit;

    const where = {
      ...(industry && { industry }),
      ...(purpose && { purpose }),
      ...(from || to
        ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.recommendationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          vehicle: {
            select: { name: true, brand: true, slug: true },
          },
        },
      }),
      prisma.recommendationLog.count({ where }),
    ]);

    // 전환율 집계 (추천 → 차량 클릭 → 견적 진행)
    const [clickedCount, proceedCount] = await Promise.all([
      prisma.recommendationLog.count({ where: { ...where, clickedVehicleId: { not: null } } }),
      prisma.recommendationLog.count({ where: { ...where, proceedToQuote: true } }),
    ]);

    // 업종별 집계
    const industryBreakdown = await prisma.recommendationLog.groupBy({
      by: ["industry"],
      where,
      _count: { industry: true },
      orderBy: { _count: { industry: "desc" } },
    });

    // 목적별 집계
    const purposeBreakdown = await prisma.recommendationLog.groupBy({
      by: ["purpose"],
      where,
      _count: { purpose: true },
      orderBy: { _count: { purpose: "desc" } },
    });

    return NextResponse.json({
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        conversion: {
          clickRate: total > 0 ? Math.round((clickedCount / total) * 100) : 0,
          proceedRate: total > 0 ? Math.round((proceedCount / total) * 100) : 0,
        },
        breakdowns: {
          industry: Object.fromEntries(
            industryBreakdown.map((b) => [b.industry, b._count.industry])
          ),
          purpose: Object.fromEntries(
            purposeBreakdown.map((b) => [b.purpose, b._count.purpose])
          ),
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/logs/recommendation]", error);
    return NextResponse.json(
      { error: "추천 로그 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
