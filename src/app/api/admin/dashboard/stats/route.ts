/**
 * DASHBOARD STATS API (NATIVE DATE VERSION)
 * Updated at: 2026-04-23
 * This file does NOT use date-fns to avoid build errors.
 */
import { NextResponse } from "next/server";
import type { SavedQuote, Vehicle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";

export async function GET() {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

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

    // 3. 이달 신규 상담 (SavedQuote 기준, 소프트 삭제 제외)
    const monthlyConsultations = await prisma.savedQuote.count({
      where: {
        createdAt: { gte: thisMonthStart },
        deletedAt: null,
      },
    });

    const lastMonthConsultations = await prisma.savedQuote.count({
      where: {
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        deletedAt: null,
      },
    });

    // 4. 계약 전환율
    const totalQuotes = await prisma.savedQuote.count({ where: { deletedAt: null } });
    const convertedQuotes = await prisma.savedQuote.count({
      where: { status: "CONVERTED", deletedAt: null },
    });
    const conversionRate = totalQuotes > 0 ? (convertedQuotes / totalQuotes) * 100 : 0;

    // 5. 최근 상담 (SavedQuote 기준 5건, 소프트 삭제 제외)
    const recentQuotes = await prisma.savedQuote.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const vehicleIds = [...new Set(recentQuotes.map((q: SavedQuote) => q.vehicleId))];
    const vehicles = await prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true },
    });
    const vehicleMap = new Map(vehicles.map((v: Pick<Vehicle, "id" | "name">) => [v.id, v.name]));

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
        recentQuotes: recentQuotes.map((q: SavedQuote) => ({
          id: q.id,
          name: q.customerName,
          vehicle: vehicleMap.get(q.vehicleId) || "알 수 없음",
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
