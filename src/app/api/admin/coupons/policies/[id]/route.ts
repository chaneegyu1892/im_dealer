import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";

// trigger 와 code 는 생성 후 바꿀 수 없다.
// trigger 를 바꾸면 이미 발급된 쿠폰의 자격 판정이 뒤집힌다.
const patchSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  description: z.string().max(120).nullable().optional(),
  rewardLabel: z.string().min(1).max(40).optional(),
  rewardAmount: z.number().int().min(0).nullable().optional(),
  rewardKind: z.enum(["FUEL", "CASH", "GIFT"]).optional(),
  termsNote: z.string().max(300).nullable().optional(),
  validDays: z.number().int().min(1).max(3650).nullable().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const before = await prisma.couponPolicy.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "쿠폰 정책을 찾을 수 없습니다." }, { status: 404 });
    }

    const startsAt = parsed.data.startsAt ?? before.startsAt;
    const endsAt = parsed.data.endsAt ?? before.endsAt;
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json(
        { error: "종료일은 시작일보다 뒤여야 합니다." },
        { status: 400 }
      );
    }

    const policy = await prisma.couponPolicy.update({ where: { id }, data: parsed.data });

    await logAdminAction({
      request,
      actor: { id: admin!.id, email: admin!.email },
      action: "COUPON_POLICY_UPDATE",
      resource: "CouponPolicy",
      targetId: id,
      before,
      after: policy,
    });

    return NextResponse.json({ success: true, data: policy });
  } catch (err) {
    console.error("[PATCH /api/admin/coupons/policies/[id]]", err);
    return NextResponse.json(
      { error: "쿠폰 정책을 수정하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const before = await prisma.couponPolicy.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "쿠폰 정책을 찾을 수 없습니다." }, { status: 404 });
    }

    const issuedCount = await prisma.issuedCoupon.count({ where: { policyId: id } });
    if (issuedCount > 0) {
      return NextResponse.json(
        {
          error: `이미 ${issuedCount}장이 발급된 정책은 삭제할 수 없습니다. 비활성으로 전환해 주세요.`,
        },
        { status: 409 }
      );
    }

    await prisma.couponPolicy.delete({ where: { id } });

    await logAdminAction({
      request,
      actor: { id: admin!.id, email: admin!.email },
      action: "COUPON_POLICY_DELETE",
      resource: "CouponPolicy",
      targetId: id,
      before,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/coupons/policies/[id]]", err);
    return NextResponse.json(
      { error: "쿠폰 정책을 삭제하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
