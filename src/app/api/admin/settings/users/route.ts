import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast, requireSuperAdmin } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { USER_ROLES } from "@/lib/user-roles";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  // admin/superadmin 만 사용자 전체 목록을 조회할 수 있다.
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const roleParam = searchParams.get("role");
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT)))
  );

  const where: Prisma.UserWhereInput = {};
  if (roleParam && (USER_ROLES as readonly string[]).includes(roleParam)) {
    where.role = roleParam;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        provider: true,
        kakaoNickname: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: users,
    meta: { total, page, limit },
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  // 사용자 권한 변경은 슈퍼어드민 전용.
  const { admin: requester, error } = await requireSuperAdmin();
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
  if (id === requester.id) {
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
      provider: true,
      kakaoNickname: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  await logAdminAction({
    request: req,
    actor: { id: requester.id, email: requester.email ?? "" },
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
}
