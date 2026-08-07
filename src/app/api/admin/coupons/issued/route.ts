import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";

const querySchema = z.object({
  status: z.enum(["ALL", "HELD", "PENDING", "PAID", "EXPIRED", "REVOKED"]).default("PENDING"),
  q: z.string().trim().max(60).optional(),
});

export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  const parsed = querySchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 검색 조건입니다." }, { status: 400 });
  }

  const { status, q } = parsed.data;

  try {
    const coupons = await prisma.issuedCoupon.findMany({
      where: {
        ...(status === "ALL" ? {} : { status }),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" as const } },
                { user: { name: { contains: q, mode: "insensitive" as const } } },
                { user: { phone: { contains: q } } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        code: true,
        status: true,
        titleSnapshot: true,
        rewardLabelSnapshot: true,
        rewardAmountSnapshot: true,
        issuedAt: true,
        qualifiedAt: true,
        paidAt: true,
        paidMemo: true,
        user: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json({ success: true, data: coupons });
  } catch (err) {
    console.error("[GET /api/admin/coupons/issued]", err);
    return NextResponse.json(
      { error: "발급 현황을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
