import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

const bulkDiscountSchema = z.union([
  // 금액 입력 모드: discountAmount (원 단위), null이면 할인 해제
  z.object({
    trimIds: z.array(z.string().min(1)).min(1, "트림을 1개 이상 선택하세요"),
    discountAmount: z.number().int().positive().nullable(),
    discountRate: z.undefined(),
  }),
  // 비율 입력 모드: discountRate (0~99%), null이면 할인 해제
  z.object({
    trimIds: z.array(z.string().min(1)).min(1, "트림을 1개 이상 선택하세요"),
    discountAmount: z.undefined(),
    discountRate: z.number().min(0).max(99).nullable(),
  }),
]);

// PATCH /api/admin/vehicles/[id]/trims/bulk-discount
// 선택한 트림들의 discountPrice를 일괄 적용 (null이면 할인 해제).
export async function PATCH(request: NextRequest, { params }: Params) {
  // 트림 할인가 일괄 변경은 재무 영향 작업 — staff 이상만 (dealer 차단, PAGE_ACCESS /admin/vehicles 와 일치).
  const { admin, error: authError } = await requireRoleAtLeast("staff");
  if (authError) return authError;

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

    const { trimIds, discountAmount, discountRate } = parsed.data;

    const existingTrims = await prisma.trim.findMany({
      where: { id: { in: trimIds }, vehicleId: id },
      select: { id: true, price: true },
    });

    if (existingTrims.length !== trimIds.length) {
      return NextResponse.json({ error: "일부 트림을 찾을 수 없습니다." }, { status: 404 });
    }

    // 할인 해제 (금액/비율 모두 null)
    if (discountAmount === null || discountRate === null) {
      await prisma.trim.updateMany({
        where: { id: { in: trimIds }, vehicleId: id },
        data: { discountPrice: null },
      });
    } else if (discountAmount !== undefined) {
      // 금액 모드: discountPrice = price - discountAmount
      await Promise.all(
        existingTrims.map((trim) => {
          const discountPrice = trim.price - discountAmount;
          if (discountPrice <= 0) return Promise.resolve();
          return prisma.trim.update({ where: { id: trim.id }, data: { discountPrice } });
        })
      );
    } else if (discountRate !== undefined) {
      // 비율 모드: discountPrice = round(price * (1 - rate/100))
      await Promise.all(
        existingTrims.map((trim) => {
          const discountPrice = Math.round(trim.price * (1 - discountRate / 100));
          if (discountPrice <= 0) return Promise.resolve();
          return prisma.trim.update({ where: { id: trim.id }, data: { discountPrice } });
        })
      );
    }

    await logAdminAction({
      request,
      actor: admin,
      action: "TRIM_BULK_DISCOUNT",
      resource: "Trim",
      targetId: id,
      after: { trimIds, discountAmount, discountRate },
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
