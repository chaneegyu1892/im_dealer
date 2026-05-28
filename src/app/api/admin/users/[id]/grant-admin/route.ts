import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSuperAdmin } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: supabaseId } = await params;

  const { admin: requester, error } = await requireSuperAdmin();
  if (error) return error;

  const { role } = await request.json();
  if (!["superadmin", "admin", "dealer"].includes(role)) {
    return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
  }

  try {
    const adminClient = supabaseAdmin();

    const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(supabaseId);
    if (userError || !user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const email = user.email ?? null;
    const name = user.user_metadata?.name || user.user_metadata?.full_name || email?.split("@")[0] || "사용자";

    // User 테이블 upsert (supabaseId 기준)
    const updatedUser = await prisma.user.upsert({
      where: { supabaseId },
      update: { isActive: true, role },
      create: {
        supabaseId,
        email,
        name,
        role,
        isActive: true,
      },
    });

    await logAdminAction({
      request,
      actor: requester,
      action: "ACCOUNT_UPDATE",
      resource: "User",
      targetId: updatedUser.id,
      meta: { role, grantedToSupabaseId: supabaseId, email: updatedUser.email },
    });

    return NextResponse.json({ success: true, admin: updatedUser });
  } catch (error) {
    console.error("[POST /api/admin/users/[id]/grant-admin]", error);
    return NextResponse.json({ error: "권한 부여 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: supabaseId } = await params;

  const { admin: requester, error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const dbUser = await prisma.user.findUnique({ where: { supabaseId } });
    if (dbUser) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { role: "member", isActive: false },
      });
    }

    await logAdminAction({
      request,
      actor: requester,
      action: "ACCOUNT_UPDATE",
      resource: "User",
      targetId: dbUser?.id,
      meta: { revokedFromSupabaseId: supabaseId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/users/[id]/grant-admin]", error);
    return NextResponse.json({ error: "권한 회수 중 오류가 발생했습니다." }, { status: 500 });
  }
}
