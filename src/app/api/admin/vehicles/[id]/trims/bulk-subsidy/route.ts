import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

const bulkSubsidySchema = z.object({
  trimIds: z.array(z.string().min(1)).min(1, "트림을 1개 이상 선택하세요"),
  // 전기차 보조금(원 단위). null이면 보조금 해제(미표시).
  evSubsidy: z.number().int().min(0, "보조금은 0 이상이어야 합니다").nullable(),
});

// PATCH /api/admin/vehicles/[id]/trims/bulk-subsidy
// 선택한 트림들의 evSubsidy를 일괄 적용 (null이면 해제).
// ⚠️ 보조금은 견적 계산에 반영하지 않는 안내 표기 전용 값이다.
export async function PATCH(request: NextRequest, { params }: Params) {
  // 트림 보조금 일괄 변경 — 할인 일괄 적용과 동일하게 staff 이상만 허용.
  const { admin, error: authError } = await requireRoleAtLeast("staff");
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = bulkSubsidySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { trimIds, evSubsidy } = parsed.data;

    const existingCount = await prisma.trim.count({
      where: { id: { in: trimIds }, vehicleId: id },
    });
    if (existingCount !== trimIds.length) {
      return NextResponse.json({ error: "일부 트림을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.trim.updateMany({
      where: { id: { in: trimIds }, vehicleId: id },
      data: { evSubsidy },
    });

    await logAdminAction({
      request,
      actor: admin,
      action: "TRIM_BULK_SUBSIDY",
      resource: "Trim",
      targetId: id,
      after: { trimIds, evSubsidy },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, count: trimIds.length });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]/trims/bulk-subsidy]", error);
    return NextResponse.json(
      { error: "일괄 보조금 적용 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
