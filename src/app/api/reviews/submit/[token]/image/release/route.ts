import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  releaseReviewImageUpload,
  resolveReviewToken,
  REVIEW_TOKEN_REASON_MESSAGE,
} from "@/lib/review-token";
import { deleteReviewImage } from "@/lib/supabase/storage";

export const runtime = "nodejs";

const releaseSchema = z.object({
  uploadIds: z.array(z.string().min(1)).max(5),
});

async function parseBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const parsed = releaseSchema.safeParse(await parseBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const uniqueIds = [...new Set(parsed.data.uploadIds)];
  if (uniqueIds.length === 0) {
    return NextResponse.json({ success: true, data: { released: 0 } });
  }

  const resolved = await resolveReviewToken(token);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: REVIEW_TOKEN_REASON_MESSAGE[resolved.reason], reason: resolved.reason },
      { status: 410 },
    );
  }

  let uploads: Array<{ id: string; path: string }> = [];
  try {
    uploads = await prisma.reviewImageUpload.findMany({
      where: {
        id: { in: uniqueIds },
        reviewRequestTokenId: resolved.data.id,
        usedAt: null,
      },
      select: { id: true, path: true },
    });
  } catch (error) {
    console.error("[POST /api/reviews/submit/[token]/image/release] lookup failed:", error);
    return NextResponse.json({ success: true, data: { released: 0 } });
  }

  let released = 0;
  for (const upload of uploads) {
    try {
      await deleteReviewImage(upload.path);
    } catch (error) {
      console.error(
        "[POST /api/reviews/submit/[token]/image/release] storage delete failed:",
        upload.id,
        error,
      );
    }
    try {
      await releaseReviewImageUpload(upload.id);
      released += 1;
    } catch (error) {
      console.error(
        "[POST /api/reviews/submit/[token]/image/release] ledger release failed:",
        upload.id,
        error,
      );
    }
  }

  return NextResponse.json({ success: true, data: { released } });
}
