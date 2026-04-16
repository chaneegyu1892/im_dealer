import { NextResponse } from "next/server";
import { getAdminBrands } from "@/lib/admin-queries";

// ─── GET /api/admin/brands ──────────────────────────────
export async function GET() {
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
