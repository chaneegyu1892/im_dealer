import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminBrands } from "@/lib/admin-queries";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { brandCreateSchema } from "@/lib/validations/admin";
import { logAdminAction } from "@/lib/audit";

// ─── GET /api/admin/brands ──────────────────────────────
export async function GET() {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const brands = await getAdminBrands();
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    console.error("[GET /api/admin/brands]", error);
    return NextResponse.json(
      { error: "브랜드 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── POST /api/admin/brands ─────────────────────────────
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const body = await request.json();
    const parsed = brandCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.brand.findUnique({ where: { name: parsed.data.name } });
    if (existing) {
      return NextResponse.json(
        { error: "이미 동일한 브랜드명이 존재합니다." },
        { status: 400 }
      );
    }

    // 신규 브랜드는 기본적으로 우선 5개 브랜드(현대/기아/제네시스/BMW/벤츠) 뒤에 가나다순으로 배치되도록
    // displayOrder 기본값을 1000으로 사용. 정렬 키는 (displayOrder ASC, name ASC).
    const brand = await prisma.brand.create({
      data: {
        name: parsed.data.name,
        logoUrl: parsed.data.logoUrl ?? null,
        displayOrder: parsed.data.displayOrder ?? 1000,
      },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "BRAND_CREATE",
      resource: "Brand",
      targetId: brand.id,
      after: brand,
    });

    return NextResponse.json({ success: true, data: brand }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/brands]", error);
    return NextResponse.json(
      { error: "브랜드 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
