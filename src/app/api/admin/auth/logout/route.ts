import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_OPTIONS, getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

// ─── POST /api/admin/auth/logout ──────────────────────────
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (session) {
    await logAdminAction({
      request,
      actor: { id: session.id, email: session.email },
      action: "LOGOUT",
      resource: "AdminUser",
      targetId: session.id,
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...ADMIN_COOKIE_OPTIONS, value: "", maxAge: 0 });
  return response;
}
