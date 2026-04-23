import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { QuoteStatus } from "@prisma/client";

const patchSchema = z.object({
  status: z.nativeEnum(QuoteStatus).optional(),
  assigneeId: z.string().nullable().optional(),
  internalMemo: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "잘못된 요청" }, { status: 400 });
  }

  const { status, assigneeId, internalMemo } = parsed.data;

  const quote = await prisma.savedQuote.findUnique({ where: { id } });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  const payload: Record<string, unknown> = {};

  if (status !== undefined && status !== quote.status) {
    updateData.status = status;
    if (status === "CONTACTED") updateData.contactedAt = new Date();
    if (status === "CONVERTED") updateData.convertedAt = new Date();
    payload.from = quote.status;
    payload.to = status;
  }
  if (assigneeId !== undefined) {
    updateData.assigneeId = assigneeId;
    payload.assigneeId = assigneeId;
  }
  if (internalMemo !== undefined) {
    updateData.internalMemo = internalMemo;
    payload.internalMemo = "updated";
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: true, data: quote });
  }

  const [updated] = await prisma.$transaction([
    prisma.savedQuote.update({ where: { id: params.id }, data: updateData }),
    prisma.quoteActivityLog.create({
      data: {
        quoteId: params.id,
        actorId: admin!.id,
        action: status !== undefined ? "STATUS_CHANGED" : assigneeId !== undefined ? "ASSIGNED" : "MEMO_UPDATED",
        payload: payload as Record<string, string>,
      },
    }),
  ]);

  return NextResponse.json({ success: true, data: updated });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const quote = await prisma.savedQuote.findUnique({
    where: { id: params.id },
    include: { activityLogs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: quote });
}
