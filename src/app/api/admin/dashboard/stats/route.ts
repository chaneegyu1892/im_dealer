import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/admin-queries";

// ─── GET /api/admin/dashboard/stats ─────────────────────
export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/dashboard/stats]", error);
    return NextResponse.json(
      { error: "대시보드 데이터 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
