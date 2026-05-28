import { NextResponse, type NextRequest } from "next/server";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { getVehicleQuoteStats } from "@/lib/admin-queries";
import { periodToSince, type CalcPeriod } from "@/lib/admin-queries/quote-calc-stats";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_PERIODS: CalcPeriod[] = ["7d", "30d", "all"];

export async function GET(request: NextRequest, { params }: Params) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const periodRaw = request.nextUrl.searchParams.get("period") ?? "30d";
    const period: CalcPeriod = (ALLOWED_PERIODS as string[]).includes(periodRaw)
      ? (periodRaw as CalcPeriod)
      : "30d";

    const since = periodToSince(period);
    const data = await getVehicleQuoteStats(id, since);
    return NextResponse.json({ success: true, data, period });
  } catch (error) {
    console.error("[GET /api/admin/vehicles/[id]/quote-stats]", error);
    return NextResponse.json(
      { error: "차량 견적 통계 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
