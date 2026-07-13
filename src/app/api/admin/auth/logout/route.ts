import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { VEHICLE_IMAGE_E2E_ADMIN_COOKIE } from "@/lib/vehicle-images/e2e-admin-session";

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

  const response = NextResponse.json({ success: true });
  response.cookies.delete(VEHICLE_IMAGE_E2E_ADMIN_COOKIE);
  return response;
}
