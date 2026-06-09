import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";

// GET /api/admin/quote-stats/range-exceeded?days=30&limit=10
// 최근 N일간 회수율 시트 범위(min~max)를 벗어난 견적을 트림별로 집계.
// 어드민에게 "이 트림들은 max를 더 넓혀야 합니다" 신호로 제공.
export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const days = Math.min(Number(searchParams.get("days") ?? 30), 365);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // 1) 범위초과 발생 건수를 트림별로 그룹핑 (한 세션·시나리오 다중 카운트 방지를 위해 sessionId distinct는 SQL로)
    const rows = await prisma.$queryRaw<
      Array<{ trimId: string; vehicleId: string; vehicleName: string; trimName: string; exceeded_count: bigint; sessions: bigint }>
    >`
      SELECT
        q."trimId",
        q."vehicleId",
        q."vehicleName",
        t."name" AS "trimName",
        COUNT(*)::bigint AS exceeded_count,
        COUNT(DISTINCT q."sessionId")::bigint AS sessions
      FROM "QuoteCalcLog" q
      LEFT JOIN "Trim" t ON t."id" = q."trimId"
      WHERE q."rangeExceeded" = true
        AND q."createdAt" >= ${since}
        AND q."trimId" IS NOT NULL
      GROUP BY q."trimId", q."vehicleId", q."vehicleName", t."name"
      ORDER BY exceeded_count DESC
      LIMIT ${limit}
    `;

    const totalExceeded = await prisma.quoteCalcLog.count({
      where: { rangeExceeded: true, createdAt: { gte: since } },
    });

    return NextResponse.json({
      success: true,
      data: {
        since: since.toISOString(),
        days,
        totalExceeded,
        items: rows.map((r) => ({
          trimId: r.trimId,
          vehicleId: r.vehicleId,
          vehicleName: r.vehicleName ?? "(이름 미상)",
          trimName: r.trimName ?? "(삭제된 트림)",
          exceededCount: Number(r.exceeded_count),
          sessions: Number(r.sessions),
        })),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/quote-stats/range-exceeded]", err);
    return NextResponse.json({ error: "집계 실패" }, { status: 500 });
  }
}
