import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { brandUpdateSchema } from "@/lib/validations/admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

// ─── PATCH /api/admin/brands/[id] ───────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin: session, error: authError } = await requireRoleAtLeast("staff");
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = brandUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const before = await prisma.brand.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
    }

    const update: {
      name?: string;
      logoUrl?: string | null;
      displayOrder?: number;
      isFeatured?: boolean;
    } = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name.trim();
    if (parsed.data.logoUrl !== undefined) update.logoUrl = parsed.data.logoUrl;
    if (parsed.data.displayOrder !== undefined) update.displayOrder = parsed.data.displayOrder;
    if (parsed.data.isFeatured !== undefined) update.isFeatured = parsed.data.isFeatured;

    // 이름 변경 시 중복 체크 (자기 자신 제외)
    if (update.name && update.name !== before.name) {
      const duplicate = await prisma.brand.findFirst({
        where: { name: update.name, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "이미 존재하는 브랜드명입니다." },
          { status: 400 }
        );
      }
    }

    // 이름 변경 시 Vehicle.brand 문자열도 트랜잭션으로 함께 갱신
    const isRename = !!update.name && update.name !== before.name;
    const [updated] = await prisma.$transaction([
      prisma.brand.update({ where: { id }, data: update }),
      ...(isRename
        ? [
            prisma.vehicle.updateMany({
              where: { brand: before.name },
              data: { brand: update.name! },
            }),
          ]
        : []),
    ]);

    await logAdminAction({
      request,
      actor: session,
      action: "BRAND_UPDATE",
      resource: "Brand",
      targetId: id,
      before,
      after: updated,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/brands/[id]]", error);
    return NextResponse.json(
      { error: "브랜드 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/brands/[id] ──────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin: session, error: authError } = await requireRoleAtLeast("staff");
  if (authError) return authError;

  try {
    const { id } = await params;

    const before = await prisma.brand.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
    }

    // 연결된 차량이 있으면 삭제 금지
    const vehicleCount = await prisma.vehicle.count({ where: { brand: before.name } });
    if (vehicleCount > 0) {
      return NextResponse.json(
        {
          error: `이 브랜드를 사용하는 차량이 ${vehicleCount}대 있습니다. 먼저 차량을 다른 브랜드로 옮기거나 삭제해 주세요.`,
        },
        { status: 409 }
      );
    }

    await prisma.brand.delete({ where: { id } });

    await logAdminAction({
      request,
      actor: session,
      action: "BRAND_DELETE",
      resource: "Brand",
      targetId: id,
      before,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/brands/[id]]", error);
    return NextResponse.json(
      { error: "브랜드 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
