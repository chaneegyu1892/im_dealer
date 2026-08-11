import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";

const policyBodySchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]{3,40}$/, "코드는 대문자·숫자·밑줄 3~40자여야 합니다."),
  trigger: z.enum(["SIGNUP", "FIRST_CONTRACT", "REFERRAL_RECEIVED", "REFERRAL_GIVEN"]),
  title: z.string().min(1).max(60),
  description: z.string().max(120).nullable().optional(),
  rewardLabel: z.string().min(1).max(40),
  rewardAmount: z.number().int().min(0).nullable().optional(),
  rewardKind: z.enum(["FUEL", "CASH", "GIFT"]),
  termsNote: z.string().max(300).nullable().optional(),
  validDays: z.number().int().min(1).max(3650).nullable().optional(),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
});

function validatePeriod(startsAt?: Date | null, endsAt?: Date | null): string | null {
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return "종료일은 시작일보다 뒤여야 합니다.";
  }
  return null;
}

export async function GET() {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const policies = await prisma.couponPolicy.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, data: policies });
  } catch (err) {
    console.error("[GET /api/admin/coupons/policies]", err);
    return NextResponse.json(
      { error: "쿠폰 정책을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { admin, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const body: unknown = await request.json();
    const parsed = policyBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const periodError = validatePeriod(parsed.data.startsAt, parsed.data.endsAt);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 400 });
    }

    const duplicated = await prisma.couponPolicy.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });
    if (duplicated) {
      return NextResponse.json({ error: "이미 사용 중인 코드입니다." }, { status: 409 });
    }

    const policy = await prisma.couponPolicy.create({ data: parsed.data });

    await logAdminAction({
      request,
      actor: { id: admin!.id, email: admin!.email },
      action: "COUPON_POLICY_CREATE",
      resource: "CouponPolicy",
      targetId: policy.id,
      after: policy,
    });

    return NextResponse.json({ success: true, data: policy }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/coupons/policies]", err);
    return NextResponse.json(
      { error: "쿠폰 정책을 저장하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
