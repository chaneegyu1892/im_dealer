import { NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/admin-queries";
import { requireRoleAtLeast } from "@/lib/require-admin";

// ─── GET /api/admin/analytics ───────────────────────────
export async function GET() {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const data = await getAnalyticsData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/analytics]", error);
    return NextResponse.json(
      { error: "분석 데이터 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
