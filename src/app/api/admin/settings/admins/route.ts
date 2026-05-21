import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminLike, requireSuperAdmin } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { USER_ROLES } from "@/lib/user-roles";

export async function GET() {
  // admin/superadmin 만 어드민 목록을 조회 가능.
  const { error } = await requireAdminLike();
  if (error) return error;

  try {
    const admins = await prisma.user.findMany({
      where: { role: { not: "member" } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: admins });
  } catch (err) {
    console.error("[GET /api/admin/settings/admins]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  // 어드민 권한·활성 상태 변경은 슈퍼어드민 전용.
  // 이전엔 isAdminLike 였어서 일반 admin 이 다른 admin/superadmin 권한을 임의 변경할 수 있는 허점이 있었다.
  const { admin: session, error } = await requireSuperAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "유효하지 않은 요청 본문입니다." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const { id, role, isActive } = parsed.data;

  if (role === undefined && isActive === undefined) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  // 본인 보호: 슈퍼어드민이 자기 자신의 역할/활성 상태를 바꾸지 못하게 막는다.
  if (id === session.id) {
    return NextResponse.json(
      { error: "본인의 권한·상태는 변경할 수 없습니다." },
      { status: 400 }
    );
  }

  const before = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!before) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await logAdminAction({
      request: req,
      actor: { id: session.id, email: session.email ?? "" },
      action: "ACCOUNT_UPDATE",
      resource: "User",
      targetId: id,
      before,
      after: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[PATCH /api/admin/settings/admins]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
