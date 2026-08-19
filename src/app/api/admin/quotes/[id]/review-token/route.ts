import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { issueOrReuseReviewToken } from "@/lib/review-token-issue";

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

    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const issued = await issueOrReuseReviewToken({
      quoteId,
      createdById: session.id,
    });

    if (!issued.reused) {
      await logAdminAction({
        request,
        actor: session,
        action: "REVIEW_TOKEN_ISSUE",
        resource: "ReviewRequestToken",
        targetId: issued.id,
        after: { savedQuoteId: quoteId, expiresAt: issued.expiresAt },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          token: issued.token,
          url: issued.url,
          expiresAt: issued.expiresAt,
          reused: issued.reused,
        },
      },
      { status: issued.reused ? 200 : 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/quotes/[id]/review-token]", error);
    return NextResponse.json(
      { error: "후기 링크 발급 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
