import { NextResponse } from "next/server";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { getReviewRequestTokensForAdmin } from "@/lib/admin-queries";

export async function GET() {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const data = await getReviewRequestTokensForAdmin();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/review-tokens]", error);
    return NextResponse.json(
      { error: "토큰 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
