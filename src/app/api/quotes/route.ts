import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminNotification } from "@/lib/admin-notification";
import { z } from "zod";

const quotesPostSchema = z.object({
  sessionId: z.string().min(1),
  customerName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
});

class QuoteRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const parsed = quotesPostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { sessionId, customerName, phone } = parsed.data;
    const contactData = {
      userId: user.id,
      customerName: customerName ?? "고객",
      phone: phone ?? "연락처 미입력",
    };
    const savedQuote = await prisma.$transaction(async (tx) => {
      const existingQuote = await tx.savedQuote.findUnique({
        where: { sessionId },
        select: { id: true, userId: true, deletedAt: true },
      });
      if (!existingQuote) {
        throw new QuoteRequestError(
          "저장된 견적을 찾을 수 없습니다. 견적을 다시 산출해 주세요.",
          409
        );
      }
      if (existingQuote.deletedAt) {
        throw new QuoteRequestError("삭제된 견적입니다.", 410);
      }
      if (existingQuote.userId && existingQuote.userId !== user.id) {
        throw new QuoteRequestError("접근 권한이 없습니다.", 403);
      }

      const ownershipWhere = {
        id: existingQuote.id,
        deletedAt: null,
        OR: [{ userId: null }, { userId: user.id }],
      };
      const notificationClaim = await tx.savedQuote.updateMany({
        where: {
          ...ownershipWhere,
          customerName: null,
          phone: null,
        },
        data: contactData,
      });
      if (notificationClaim.count === 0) {
        const enrichment = await tx.savedQuote.updateMany({
          where: ownershipWhere,
          data: contactData,
        });
        if (enrichment.count === 0) {
          throw new QuoteRequestError("접근 권한이 없습니다.", 403);
        }
      }

      const currentQuote = await tx.savedQuote.findUniqueOrThrow({
        where: { id: existingQuote.id },
      });
      if (notificationClaim.count === 1) {
        await createAdminNotification({
          type: "NEW_QUOTE",
          title: "새로운 견적 신청",
          content: currentQuote.pricingStatus === "CONSULTATION_REQUIRED"
            ? `${contactData.customerName}님이 별도 상담 견적을 신청했습니다.`
            : `${contactData.customerName}님이 새로운 견적 상담을 신청했습니다. (${currentQuote.monthlyPayment.toLocaleString()}원/월)`,
          linkUrl: `/admin/quotations?id=${currentQuote.id}`,
          client: tx,
        });
      }
      return currentQuote;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: savedQuote.id,
        sessionId: savedQuote.sessionId,
        requiresConsultation: savedQuote.pricingStatus === "CONSULTATION_REQUIRED",
      },
    });
  } catch (error) {
    if (error instanceof QuoteRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      console.error("[POST /api/quotes]", error);
    } else {
      console.error("[POST /api/quotes] unknown error");
    }
    return NextResponse.json(
      { error: "견적 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
