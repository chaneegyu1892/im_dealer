import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { getAllReviewsForAdmin } from "@/lib/admin-queries";
import { logAdminAction } from "@/lib/audit";

const reviewCreateSchema = z.object({
  authorRealName: z.string().min(1).max(50),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1).max(2000),
  vehicleId: z.string().nullable().optional(),
  savedQuoteId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  reviewDate: z.string().datetime().optional(),
});

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const data = await getAllReviewsForAdmin();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/reviews]", error);
    return NextResponse.json(
      { error: "후기 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const body = await request.json();
    const parsed = reviewCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { reviewDate, ...rest } = parsed.data;
    const review = await prisma.review.create({
      data: {
        ...rest,
        ...(reviewDate ? { reviewDate: new Date(reviewDate) } : {}),
      },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "REVIEW_CREATE",
      resource: "Review",
      targetId: review.id,
      after: review,
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/reviews]", error);
    return NextResponse.json(
      { error: "후기 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
