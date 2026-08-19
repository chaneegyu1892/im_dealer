import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { maskAuthorName, formatReviewDate } from "@/lib/review-utils";
import {
  resolveReviewToken,
  REVIEW_TOKEN_REASON_MESSAGE,
} from "@/lib/review-token";
import { isReviewImagePublicUrl } from "@/lib/supabase/storage";
import { notifyReviewSubmitted } from "@/lib/admin-notification";
import type { ReviewWriteContext } from "@/types/review";

const submitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(10).max(1000),
  imageUrls: z.array(z.string().url()).max(5).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveReviewToken(token);

  if (!result.ok) {
    return NextResponse.json(
      { error: REVIEW_TOKEN_REASON_MESSAGE[result.reason], reason: result.reason },
      { status: 410 }
    );
  }

  const ctx: ReviewWriteContext = {
    vehicleName: result.data.vehicleName,
    customerDisplayName: result.data.customerName
      ? maskAuthorName(result.data.customerName)
      : "고객",
    quoteCreatedAt: result.data.quoteCreatedAt
      ? formatReviewDate(result.data.quoteCreatedAt)
      : null,
  };

  return NextResponse.json({ success: true, data: ctx });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "별점은 1~5, 내용은 10~1000자로 입력해 주세요.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const imageUrls = parsed.data.imageUrls ?? [];
  if (new Set(imageUrls).size !== imageUrls.length) {
    return NextResponse.json(
      { error: "같은 이미지를 중복으로 첨부할 수 없습니다." },
      { status: 400 }
    );
  }
  if (imageUrls.some((u) => !isReviewImagePublicUrl(u))) {
    return NextResponse.json(
      { error: "허용되지 않는 이미지 URL이 포함되어 있습니다." },
      { status: 400 }
    );
  }

  const resolved = await resolveReviewToken(token);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: REVIEW_TOKEN_REASON_MESSAGE[resolved.reason], reason: resolved.reason },
      { status: 410 }
    );
  }

  const { id: tokenId, savedQuoteId, vehicleId, customerName, vehicleName } = resolved.data;
  const authorRealName = customerName?.trim() || "고객";

  try {
    const review = await prisma.$transaction(async (tx) => {
      const uploads = imageUrls.length > 0
        ? await tx.reviewImageUpload.findMany({
            where: {
              reviewRequestTokenId: tokenId,
              url: { in: imageUrls },
              usedAt: null,
            },
            select: { id: true, url: true },
          })
        : [];
      if (uploads.length !== imageUrls.length) {
        throw new Error("UNOWNED_IMAGE");
      }

      const claimed = await tx.reviewRequestToken.updateMany({
        where: {
          id: tokenId,
          savedQuote: { is: { deletedAt: null } },
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count === 0) {
        throw new Error("TOKEN_RACE");
      }

      const created = await tx.review.create({
        data: {
          authorRealName,
          rating: parsed.data.rating,
          content: parsed.data.content,
          vehicleId: vehicleId ?? null,
          savedQuoteId,
          isPublic: false,
          displayOrder: 0,
          reviewDate: new Date(),
          imageUrls,
        },
      });

      await tx.reviewRequestToken.update({
        where: { id: tokenId },
        data: { reviewId: created.id },
      });

      if (uploads.length > 0) {
        const marked = await tx.reviewImageUpload.updateMany({
          where: {
            id: { in: uploads.map((upload) => upload.id) },
            reviewRequestTokenId: tokenId,
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
        if (marked.count !== uploads.length) {
          throw new Error("IMAGE_RACE");
        }
      }

      return created;
    });

    await notifyReviewSubmitted({
      reviewId: review.id,
      authorDisplayName: maskAuthorName(authorRealName),
      vehicleName,
      rating: parsed.data.rating,
    });

    return NextResponse.json(
      { success: true, data: { reviewId: review.id } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "TOKEN_RACE") {
      return NextResponse.json(
        { error: "이미 처리 중이거나 만료된 링크입니다.", reason: "used" },
        { status: 410 }
      );
    }
    if (error instanceof Error && error.message === "UNOWNED_IMAGE") {
      return NextResponse.json(
        { error: "이 링크에서 업로드한 이미지만 첨부할 수 있습니다." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "IMAGE_RACE") {
      return NextResponse.json(
        { error: "이미지 처리 중 충돌이 발생했습니다. 다시 시도해 주세요." },
        { status: 409 }
      );
    }
    console.error("[POST /api/reviews/submit/[token]]", error);
    return NextResponse.json(
      { error: "후기 제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
