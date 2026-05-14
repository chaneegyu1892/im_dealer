import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

const bulkDiscountSchema = z.object({
  trimIds: z.array(z.string().min(1)).min(1, "트림을 1개 이상 선택하세요"),
  discountPrice: z.number().int().positive().nullable(),
});

// ─── PATCH /api/admin/vehicles/[id]/trims/bulk-discount ──
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = bulkDiscountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { trimIds, discountPrice } = parsed.data;

    const existingTrims = await prisma.trim.findMany({
      where: { id: { in: trimIds }, vehicleId: id },
      select: { id: true },
    });

    if (existingTrims.length !== trimIds.length) {
      return NextResponse.json({ error: "일부 트림을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.trim.updateMany({
      where: { id: { in: trimIds }, vehicleId: id },
      data: { discountPrice },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "TRIM_BULK_DISCOUNT",
      resource: "Trim",
      targetId: id,
      after: { trimIds, discountPrice },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, count: trimIds.length });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]/trims/bulk-discount]", error);
    return NextResponse.json(
      { error: "일괄 할인가 적용 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
