import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { payIssuedCoupon } from "../../pay";

const bodySchema = z.object({
  memo: z.string().trim().max(200).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const raw: unknown = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "메모가 너무 깁니다." }, { status: 400 });
    }

    const result = await payIssuedCoupon(id, admin!.id, parsed.data.memo ?? null, prisma);

    if (!result.ok && result.reason === "not_found") {
      return NextResponse.json({ error: "쿠폰을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: "지급 예정 상태의 쿠폰만 지급 처리할 수 있습니다." },
        { status: 409 }
      );
    }

    await logAdminAction({
      request,
      actor: { id: admin!.id, email: admin!.email },
      action: "COUPON_PAID",
      resource: "IssuedCoupon",
      targetId: id,
      meta: { memo: parsed.data.memo ?? "" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/admin/coupons/issued/[id]/pay]", err);
    return NextResponse.json(
      { error: "지급 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
