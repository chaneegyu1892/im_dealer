import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createAdminToken,
  ADMIN_COOKIE_OPTIONS,
} from "@/lib/admin-auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── POST /api/admin/auth/login ───────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호를 확인해주세요." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { email } });

    // 타이밍 공격 방지: 계정 없어도 bcrypt 비교 수행
    const isValid =
      admin && admin.isActive
        ? await verifyPassword(password, admin.passwordHash)
        : false;

    if (!admin || !admin.isActive || !isValid) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 마지막 로그인 시각 갱신
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createAdminToken(admin.id);

    const response = NextResponse.json({ success: true });
    response.cookies.set({ ...ADMIN_COOKIE_OPTIONS, value: token });

    return response;
  } catch (error) {
    console.error("[POST /api/admin/auth/login]", error);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
