import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";

const TOKEN_TTL_DAYS = 30;

function buildReviewUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/reviews/write/${token}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  const { id: quoteId } = await params;

  try {
    const quote = await prisma.savedQuote.findUnique({
      where: { id: quoteId },
      select: { id: true, status: true, customerName: true, deletedAt: true },
    });

    if (!quote || quote.deletedAt) {
      return NextResponse.json(
        { error: "견적을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (quote.status !== "CONVERTED") {
      return NextResponse.json(
        { error: "계약완료(CONVERTED) 상태의 견적에서만 후기 링크를 발급할 수 있습니다." },
        { status: 400 }
      );
    }

    const now = new Date();

    const existing = await prisma.reviewRequestToken.findFirst({
      where: {
        savedQuoteId: quoteId,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          token: existing.token,
          url: buildReviewUrl(existing.token),
          expiresAt: existing.expiresAt,
          reused: true,
        },
      });
    }

    const expiresAt = new Date(now.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const token = randomUUID();

    const created = await prisma.reviewRequestToken.create({
      data: {
        token,
        savedQuoteId: quoteId,
        expiresAt,
        createdById: session.id,
      },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "REVIEW_TOKEN_ISSUE",
      resource: "ReviewRequestToken",
      targetId: created.id,
      after: { savedQuoteId: quoteId, expiresAt },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          token: created.token,
          url: buildReviewUrl(created.token),
          expiresAt: created.expiresAt,
          reused: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/quotes/[id]/review-token]", error);
    return NextResponse.json(
      { error: "후기 링크 발급 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
