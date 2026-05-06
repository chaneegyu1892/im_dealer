import { NextResponse, type NextRequest } from "next/server";
import { getPublicReviewById } from "@/lib/admin-queries/reviews";
import { hasUserLiked } from "@/lib/review-likes";
import { isValidAnonId } from "@/lib/anon-id";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const review = await getPublicReviewById(id);
  if (!review) {
    return NextResponse.json(
      { error: "후기를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const anonId = request.nextUrl.searchParams.get("anonId");
  const liked = isValidAnonId(anonId)
    ? await hasUserLiked(id, anonId)
    : false;

  return NextResponse.json({
    success: true,
    data: { review, liked },
  });
}
