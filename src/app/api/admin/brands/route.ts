import { NextResponse } from "next/server";
import { getAdminBrands } from "@/lib/admin-queries";
import { getAdminSession } from "@/lib/admin-auth";

// ─── GET /api/admin/brands ──────────────────────────────
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const brands = await getAdminBrands();
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    console.error("[GET /api/admin/brands]", error);
    return NextResponse.json(
      { error: "브랜드 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
