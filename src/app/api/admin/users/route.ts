import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminUsers } from "@/lib/admin-queries";

// ─── GET /api/admin/users ──────────────────────────────
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const data = await getAdminUsers();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json(
      { error: "사용자 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
