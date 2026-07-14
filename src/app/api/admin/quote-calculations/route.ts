import { NextResponse, type NextRequest } from "next/server";
import { getAdminQuoteCalculations } from "@/lib/admin-queries";
import { requireRoleAtLeast } from "@/lib/require-admin";

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const page = positiveInteger(searchParams.get("page"), 1);
    const limit = Math.min(100, positiveInteger(searchParams.get("limit"), 50));
    const { data, total } = await getAdminQuoteCalculations(page, limit);

    return NextResponse.json({
      success: true,
      data,
      meta: { total, page, limit },
    });
  } catch (error) {
    console.error("[GET /api/admin/quote-calculations]", error);
    return NextResponse.json(
      { error: "견적 계산 이력 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
