import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getAdminSession,
  verifyPassword,
  hashPassword,
} from "@/lib/admin-auth";

// ─── GET /api/admin/auth/me ───────────────────────────────
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  });
}

// ─── PATCH /api/admin/auth/me ─────────────────────────────
const updateSchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).max(100).optional(),
  })
  .refine(
    (d) => !(d.newPassword && !d.currentPassword),
    { message: "새 비밀번호를 변경하려면 현재 비밀번호를 입력해주세요.", path: ["currentPassword"] }
  );

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "입력값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { name, email, currentPassword, newPassword } = parsed.data;

    // 비밀번호 변경 시 현재 비밀번호 검증
    if (newPassword) {
      const isValid = await verifyPassword(currentPassword!, admin.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "현재 비밀번호가 올바르지 않습니다." },
          { status: 400 }
        );
      }
    }

    // 이메일 중복 확인
    if (email && email !== admin.email) {
      const existing = await prisma.adminUser.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: "이미 사용 중인 이메일입니다." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(newPassword && { passwordHash: await hashPassword(newPassword) }),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/auth/me]", error);
    return NextResponse.json(
      { error: "정보 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
