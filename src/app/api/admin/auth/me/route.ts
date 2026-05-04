import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

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
const updateSchema = z.object({
  name: z.string().min(1).max(50),
});

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

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { name: parsed.data.name },
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
