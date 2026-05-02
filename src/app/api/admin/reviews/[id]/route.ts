import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

const reviewUpdateSchema = z.object({
  authorRealName: z.string().min(1).max(50).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  content: z.string().min(1).max(2000).optional(),
  vehicleId: z.string().nullable().optional(),
  savedQuoteId: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  reviewDate: z.string().datetime().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const review = await prisma.review.findUnique({ where: { id: (await params).id } });
    if (!review) {
      return NextResponse.json({ error: "후기를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    console.error("[GET /api/admin/reviews/[id]]", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const body = await request.json();
    const parsed = reviewUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { reviewDate, ...rest } = parsed.data;

    const updated = await prisma.review.update({
      where: { id: (await params).id },
      data: {
        ...rest,
        ...(reviewDate ? { reviewDate: new Date(reviewDate) } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/reviews/[id]]", error);
    return NextResponse.json({ error: "수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    await prisma.review.delete({ where: { id: (await params).id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/reviews/[id]]", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
