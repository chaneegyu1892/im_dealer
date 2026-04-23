/**
 * DASHBOARD STATS API (NATIVE DATE VERSION)
 * Updated at: 2026-04-23
 * This file does NOT use date-fns to avoid build errors.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const now = new Date();
    
    // 오늘 시작과 끝
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // 이번 달 시작
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    
    // 지난 달 시작과 끝
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // 1. 등록 차량 통계
    const totalVehicles = await prisma.vehicle.count();
    const visibleVehicles = await prisma.vehicle.count({ where: { isVisible: true } });

    // 2. 오늘 견적 조회 (QuoteCalcLog 기준)
    const todayQuoteViews = await prisma.quoteCalcLog.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // 3. 이달 신규 상담 (SavedQuote 기준)
    const monthlyConsultations = await prisma.savedQuote.count({
      where: {
        createdAt: {
          gte: thisMonthStart,
        },
      },
    });

    const lastMonthConsultations = await prisma.savedQuote.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    });

    // 4. 계약 전환율
    const totalQuotes = await prisma.savedQuote.count();
    const convertedQuotes = await prisma.savedQuote.count({
      where: { status: "CONVERTED" },
    });
    const conversionRate = totalQuotes > 0 ? (convertedQuotes / totalQuotes) * 100 : 0;

    // 5. 최근 상담 (SavedQuote 기준 5건)
    const recentQuotes = await prisma.savedQuote.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { Vehicle: { select: { name: true } } }
    });

    // 6. 주간 데이터 (최근 7일)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      
      const count = await prisma.quoteCalcLog.count({
        where: { createdAt: { gte: start, lte: end } }
      });
      
      weeklyData.push({
        day: `${date.getMonth() + 1}/${date.getDate()}`,
        value: count
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalVehicles,
          visibleVehicles,
          todayQuoteViews,
          todayAISessions: 0,
          monthlyConsultations,
          lastMonthConsultations,
          conversionRate: conversionRate.toFixed(1),
        },
        recentQuotes: recentQuotes.map(q => ({
          id: q.id,
          name: q.customerName,
          vehicle: q.Vehicle.name,
          time: q.createdAt,
          status: q.status,
        })),
        weeklyQuoteData: weeklyData,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/dashboard/stats]", error);
    return NextResponse.json(
      { error: "통계 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
