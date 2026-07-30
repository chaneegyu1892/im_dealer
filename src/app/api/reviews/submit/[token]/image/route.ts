import { NextResponse, type NextRequest } from "next/server";
import {
  releaseReviewImageUpload,
  reserveReviewImageUpload,
  resolveReviewToken,
  REVIEW_TOKEN_REASON_MESSAGE,
} from "@/lib/review-token";
import {
  deleteReviewImage,
  REVIEW_IMAGE_ALLOWED_MIME,
  REVIEW_IMAGE_MAX_SIZE,
  uploadReviewImage,
} from "@/lib/supabase/storage";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const resolved = await resolveReviewToken(token);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: REVIEW_TOKEN_REASON_MESSAGE[resolved.reason], reason: resolved.reason },
      { status: 410 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "파일이 첨부되지 않았습니다." }, { status: 400 });
  }

  if (file.size > REVIEW_IMAGE_MAX_SIZE) {
    return NextResponse.json(
      { error: "이미지 용량은 5MB 이하여야 합니다." },
      { status: 400 }
    );
  }

  const contentType = file.type;
  if (!REVIEW_IMAGE_ALLOWED_MIME.has(contentType)) {
    return NextResponse.json(
      { error: "JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }

  let reservation: Awaited<ReturnType<typeof reserveReviewImageUpload>>;
  try {
    reservation = await reserveReviewImageUpload({
      reviewRequestTokenId: resolved.data.id,
      byteSize: file.size,
      contentType,
    });
  } catch (error) {
    console.error("[POST /api/reviews/submit/[token]/image] upload reservation failed:", error);
    return NextResponse.json(
      { error: "이미지 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  if (!reservation.ok) {
    if (reservation.reason === "quota") {
      return NextResponse.json(
        { error: "이미지는 최대 5장, 총 25MB까지 업로드할 수 있습니다." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "이미 처리 중이거나 만료된 링크입니다.", reason: "used" },
      { status: 410 }
    );
  }

  try {
    await uploadReviewImage({
      path: reservation.data.path,
      file,
      contentType,
    });
    return NextResponse.json({ success: true, data: reservation.data }, { status: 201 });
  } catch (error) {
    try {
      await deleteReviewImage(reservation.data.path);
      await releaseReviewImageUpload(reservation.data.id);
    } catch {
      console.error("[POST /api/reviews/submit/[token]/image] upload cleanup failed");
    }
    console.error("[POST /api/reviews/submit/[token]/image]", error);
    return NextResponse.json(
      { error: "이미지 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
