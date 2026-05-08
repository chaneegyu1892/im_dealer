import { NextResponse } from "next/server";
import { getRecentVerifications } from "@/lib/admin-queries";
import { requireRoleAtLeast } from "@/lib/require-admin";

// ─── GET /api/admin/verifications ────────────────────────
export async function GET() {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const data = await getRecentVerifications(50);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/verifications]", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
