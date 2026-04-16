import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession, hashPassword } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  role: z.enum(["admin", "operator"]).optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

// ─── PATCH /api/admin/accounts/[id] ──────────────────────
export async function PATCH(request: Request, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { name, role, isActive, newPassword } = parsed.data;

    // 자기 자신 비활성화 방지
    if (id === admin.id && isActive === false) {
      return NextResponse.json(
        { error: "자신의 계정을 비활성화할 수 없습니다." },
        { status: 400 }
      );
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(newPassword && { passwordHash: await hashPassword(newPassword) }),
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/accounts/[id]]", error);
    return NextResponse.json(
      { error: "계정 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/accounts/[id] ─────────────────────
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json(
      { error: "자신의 계정은 삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  await prisma.adminUser.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
