import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { popularConfigUpdateSchema } from "@/lib/validations/admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string; configId: string }> };

// ─── PATCH /api/admin/vehicles/[id]/popular-configs/[configId] ──
export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const { id: vehicleId, configId } = await params;
    const body = await request.json();
    const parsed = popularConfigUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 해당 config 가 요청 vehicleId 소속인지 검증 (소유권)
    const before = await prisma.popularConfig.findFirst({
      where: { id: configId, vehicleId },
      include: { items: { orderBy: { displayOrder: "asc" } } },
    });
    if (!before) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const { items, ...configData } = parsed.data;

    // Perform update in a transaction when items are also being replaced
    const config = await prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        // Replace all items: delete existing, then create new
        await tx.popularConfigItem.deleteMany({ where: { configId } });
        return tx.popularConfig.update({
          where: { id: configId },
          data: {
            ...configData,
            items: {
              create: items.map((item) => ({
                name: item.name,
                price: item.price,
                trimOptionId: item.trimOptionId ?? null,
                displayOrder: item.displayOrder,
              })),
            },
          },
          include: { items: { orderBy: { displayOrder: "asc" } } },
        });
      }

      return tx.popularConfig.update({
        where: { id: configId },
        data: configData,
        include: { items: { orderBy: { displayOrder: "asc" } } },
      });
    });

    await logAdminAction({
      request,
      actor: admin,
      action: "POPULAR_CONFIG_UPDATE",
      resource: "PopularConfig",
      targetId: configId,
      before,
      after: config,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]/popular-configs/[configId]]", error);
    return NextResponse.json(
      { error: "추천 구성 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/vehicles/[id]/popular-configs/[configId] ─
export async function DELETE(request: NextRequest, { params }: Params) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const { id: vehicleId, configId } = await params;
    // 소유권 검증: 다른 차량 config 변조 방지
    const before = await prisma.popularConfig.findFirst({
      where: { id: configId, vehicleId },
      include: { items: true },
    });
    if (!before) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    await prisma.popularConfig.delete({ where: { id: configId } });

    await logAdminAction({
      request,
      actor: admin,
      action: "POPULAR_CONFIG_DELETE",
      resource: "PopularConfig",
      targetId: configId,
      before,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/vehicles/[id]/popular-configs/[configId]]", error);
    return NextResponse.json(
      { error: "추천 구성 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
