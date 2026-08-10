import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revokeIssuedCoupon } from "../../revoke";

// 지급 취소는 보상 회수이므로 사유를 필수로 받는다. 빈 사유 회수를 막아야
// 감사 로그가 항상 "왜 회수했는지"를 설명한다.
const bodySchema = z.object({
  reason: z.string().trim().min(1, "취소 사유를 입력해주세요.").max(200),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // 지급(pay)은 staff+지만, 회수(revoke)는 보상 철회라 더 강한 권한(admin+)을 요구한다.
  const { admin, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const raw: unknown = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "취소 사유를 입력해주세요.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await revokeIssuedCoupon(id, admin!.id, parsed.data.reason, prisma);

    if (!result.ok && result.reason === "not_found") {
      return NextResponse.json({ error: "쿠폰을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: "지급 예정이거나 지급 완료 상태의 쿠폰만 취소할 수 있습니다." },
        { status: 409 }
      );
    }

    await logAdminAction({
      request,
      actor: { id: admin!.id, email: admin!.email },
      action: "COUPON_REVOKED",
      resource: "IssuedCoupon",
      targetId: id,
      meta: { reason: parsed.data.reason },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/admin/coupons/issued/[id]/revoke]", err);
    return NextResponse.json(
      { error: "지급 취소 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
