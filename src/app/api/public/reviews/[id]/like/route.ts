import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidAnonId } from "@/lib/anon-id";
import { likeRateLimit } from "@/lib/rate-limit";
import { toggleReviewLike } from "@/lib/review-likes";

const bodySchema = z.object({
  anonId: z.string().refine(isValidAnonId, { message: "invalid anonId" }),
});

function getClientKey(request: NextRequest, anonId: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${ip}:${anonId}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 본문입니다." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "anonId 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (likeRateLimit) {
    const { success } = await likeRateLimit.limit(
      getClientKey(request, parsed.data.anonId)
    );
    if (!success) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }
  }

  try {
    const result = await toggleReviewLike(id, parsed.data.anonId);
    if (!result) {
      return NextResponse.json(
        { error: "후기를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[POST /api/public/reviews/[id]/like]", error);
    return NextResponse.json(
      { error: "좋아요 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
