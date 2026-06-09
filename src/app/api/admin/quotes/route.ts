import { NextResponse, type NextRequest } from "next/server";
import { getAdminQuotes } from "@/lib/admin-queries";
import { requireRoleAtLeast } from "@/lib/require-admin";

// ─── GET /api/admin/quotes ──────────────────────────────
export async function GET(request: NextRequest) {
  // 전역 견적 목록은 고객 연락처/상담 상태를 포함하므로 staff 이상만 조회한다.
  // dealer 전용 목록은 별도 ownership/assignee 스코프를 붙인 뒤 개방해야 한다.
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

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
