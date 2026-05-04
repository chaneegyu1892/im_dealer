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
  
  // 1. 최종관리자 권한 확인
  const { admin: requester, error } = await requireSuperAdmin();
  if (error) return error;

  const { role } = await request.json();
  if (!["superadmin", "admin", "dealer"].includes(role)) {
    return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 });
  }

  try {
    const adminClient = supabaseAdmin();
    
    // 2. Supabase에서 사용자 정보 가져오기
    const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(supabaseId);
    if (userError || !user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const email = user.email || `kakao_${supabaseId}@imdealers.com`; // 이메일이 없는 경우 가상 이메일 생성
    const name = user.user_metadata?.name || user.user_metadata?.full_name || email.split("@")[0];

    // 3. AdminUser 테이블 업데이트 (supabaseId를 우선으로 찾고, 없으면 email로 매칭)
    let dbAdmin = await prisma.adminUser.findUnique({ where: { supabaseId } });
    
    if (!dbAdmin && user.email) {
      dbAdmin = await prisma.adminUser.findUnique({ where: { email: user.email } });
    }

    const updatedAdmin = await prisma.adminUser.upsert({
      where: { id: dbAdmin?.id || "new_id_placeholder" },
      update: {
        supabaseId,
        isActive: true,
        role: role as any,
        email: user.email || dbAdmin?.email || email,
        name,
      },
      create: {
        supabaseId,
        email,
        name,
        role: role as any,
        isActive: true,
      },
    });

    // 4. Supabase app_metadata 및 user_metadata 업데이트
    await adminClient.auth.admin.updateUserById(supabaseId, {
      app_metadata: { role: "admin" },
      user_metadata: { 
        role: role,
        isAdmin: role === "superadmin" || role === "admin",
        isDealer: role === "dealer"
      }
    });

    // 5. 감사 로그
    await logAdminAction({
      request,
      actor: requester,
      action: "ACCOUNT_UPDATE",
      resource: "AdminUser",
      targetId: updatedAdmin.id,
      meta: { role, grantedToSupabaseId: supabaseId, email: updatedAdmin.email },
    });

    return NextResponse.json({ success: true, admin: updatedAdmin });
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
    const adminClient = supabaseAdmin();

    const dbAdmin = await prisma.adminUser.findUnique({ where: { supabaseId } });
    if (dbAdmin) {
      await prisma.adminUser.update({
        where: { id: dbAdmin.id },
        data: { isActive: false, supabaseId: null },
      });
    }

    await adminClient.auth.admin.updateUserById(supabaseId, {
      app_metadata: { role: null },
      user_metadata: { role: null, isAdmin: false, isDealer: false }
    });

    await logAdminAction({
      request,
      actor: requester,
      action: "ACCOUNT_UPDATE",
      resource: "AdminUser",
      targetId: dbAdmin?.id,
      meta: { revokedFromSupabaseId: supabaseId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/users/[id]/grant-admin]", error);
    return NextResponse.json({ error: "권한 회수 중 오류가 발생했습니다." }, { status: 500 });
  }
}
