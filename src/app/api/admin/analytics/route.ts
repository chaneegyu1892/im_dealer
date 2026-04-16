import { NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/admin-queries";
import { getAdminSession } from "@/lib/admin-auth";

// ─── GET /api/admin/analytics ───────────────────────────
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
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
