import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

// 두 인기 브랜드의 displayOrder 를 트랜잭션으로 swap.
// 어드민 BrandList의 ↑↓ 버튼에서 사용.
const swapSchema = z.object({
  aId: z.string().min(1),
  bId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const { admin: session, error: authError } = await requireRoleAtLeast("staff");
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = swapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { aId, bId } = parsed.data;
    if (aId === bId) {
      return NextResponse.json({ error: "동일한 브랜드입니다." }, { status: 400 });
    }

    const [a, b] = await Promise.all([
      prisma.brand.findUnique({ where: { id: aId } }),
      prisma.brand.findUnique({ where: { id: bId } }),
    ]);
    if (!a || !b) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
    }

    // displayOrder 가 동률이면 swap 무의미. 그래도 명시적 분리를 위해 1 차이로 갱신.
    if (a.displayOrder === b.displayOrder) {
      await prisma.$transaction([
        prisma.brand.update({ where: { id: a.id }, data: { displayOrder: a.displayOrder } }),
        prisma.brand.update({ where: { id: b.id }, data: { displayOrder: b.displayOrder + 1 } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.brand.update({ where: { id: a.id }, data: { displayOrder: b.displayOrder } }),
        prisma.brand.update({ where: { id: b.id }, data: { displayOrder: a.displayOrder } }),
      ]);
    }

    await logAdminAction({
      request,
      actor: session,
      action: "BRAND_UPDATE",
      resource: "Brand",
      targetId: a.id,
      before: a,
      after: { ...a, displayOrder: b.displayOrder, swappedWith: b.id },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/admin/brands/reorder]", error);
    return NextResponse.json(
      { error: "브랜드 순서 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
