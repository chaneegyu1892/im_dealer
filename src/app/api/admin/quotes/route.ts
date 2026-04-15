import { NextResponse, type NextRequest } from "next/server";
import { getAdminQuotes } from "@/lib/admin-queries";

// ─── GET /api/admin/quotes ──────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

    const { data, total } = await getAdminQuotes(page, limit);
    return NextResponse.json({
      success: true,
      data,
      meta: { total, page, limit },
    });
  } catch (error) {
    console.error("[GET /api/admin/quotes]", error);
    return NextResponse.json(
      { error: "견적 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
