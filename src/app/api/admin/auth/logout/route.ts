import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

// ─── POST /api/admin/auth/logout ──────────────────────────
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (session) {
    await logAdminAction({
      request,
      actor: { id: session.id, email: session.email ?? "" },
      action: "LOGOUT",
      resource: "User",
      targetId: session.id,
    });
  }

  return NextResponse.json({ success: true });
}
