import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { revokeReviewTokensForQuote } from "@/lib/review-token";
import { reconcileUserCoupons } from "@/lib/coupons/reconcile";
import { QuoteStatus } from "@prisma/client";

const patchSchema = z.object({
  status: z.nativeEnum(QuoteStatus).optional(),
  assigneeId: z.string().nullable().optional(),
  internalMemo: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "잘못된 요청" }, { status: 400 });
  }

  const { status, assigneeId, internalMemo } = parsed.data;

  const quote = await prisma.savedQuote.findFirst({ where: { id, deletedAt: null } });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  const payload: Record<string, string> = {};

  if (status !== undefined && status !== quote.status) {
    updateData.status = status;
    if (status === "CONTACTED") updateData.contactedAt = new Date();
    if (status === "CONVERTED") updateData.convertedAt = new Date();
    payload.from = quote.status;
    payload.to = status;
  }
  if (assigneeId !== undefined) {
    updateData.assigneeId = assigneeId;
    payload.assigneeId = assigneeId ?? "";
  }
  if (internalMemo !== undefined) {
    updateData.internalMemo = internalMemo;
    payload.internalMemo = "updated";
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: true, data: quote });
  }

  const [updated] = await prisma.$transaction([
    prisma.savedQuote.update({ where: { id }, data: updateData }),
    prisma.quoteActivityLog.create({
      data: {
        quoteId: id,
        actorId: admin!.id,
        action: status !== undefined ? "STATUS_CHANGED" : assigneeId !== undefined ? "ASSIGNED" : "MEMO_UPDATED",
        payload,
      },
    }),
  ]);

  // CONVERTED 로 전환되면 쿠폰 지급 조건이 충족되고, CONVERTED 에서 다른 상태로
  // 철회되면 PENDING 쿠폰을 HELD 로 되돌려야 한다(reconcileUserCoupons 가 판단).
  // status 변경이 CONVERTED 를 어느 방향으로든 건드릴 때 동기화한다 — CONVERTED
  // 진입만 훅을 걸면 철회 시 PENDING 이 그대로 남아 이미 끝난 계약 건을 어드민이
  // 계속 지급 대기로 보게 된다. quote 는 트랜잭션 이전 스냅샷이라 이전 상태를 그대로 갖고 있다.
  // 회원이 쿠폰함에 들어오지 않아도 어드민 지급 대기 목록에 잡히도록 이 시점에 동기화한다.
  // 동기화 실패가 견적 상태 변경을 되돌리면 안 되므로 트랜잭션 밖에서 처리한다.
  const touchesConverted =
    status !== undefined && (status === "CONVERTED" || quote.status === "CONVERTED");
  if (touchesConverted && quote.userId) {
    try {
      const member = await prisma.user.findUnique({
        where: { supabaseId: quote.userId },
        select: { id: true, supabaseId: true, profileCompleted: true },
      });
      if (member?.supabaseId) {
        await reconcileUserCoupons({
          id: member.id,
          supabaseId: member.supabaseId,
          profileCompleted: member.profileCompleted,
        });
      }
    } catch (err) {
      console.error("[PATCH /api/admin/quotes/[id]] 쿠폰 동기화 실패:", err);
    }
  }

  return NextResponse.json({ success: true, data: updated });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  const quote = await prisma.savedQuote.findFirst({
    where: { id, deletedAt: null },
    include: { activityLogs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: quote });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    // 트랜잭션 이후 쿠폰 동기화에 쓸 삭제 전 스냅샷. updateMany 는 몇 건이 바뀌었는지만
    // 알려주므로, CONVERTED 여부와 회원 매핑에 필요한 userId 는 미리 읽어둬야 한다.
    const quote = await prisma.savedQuote.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true, status: true },
    });

    // 소프트 삭제: 감사용 행은 남기되 고객 연락처와 미사용 인증 capability 는 즉시 파기한다.
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.savedQuote.updateMany({
        where: { id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          customerName: null,
          phone: null,
          verificationCapabilityHash: null,
        },
      });
      if (deleted.count === 0) return deleted;

      await revokeReviewTokensForQuote(id, tx);

      await tx.quoteActivityLog.create({
        data: {
          quoteId: id,
          actorId: admin!.id,
          action: "DELETED",
          payload: { soft: "true" },
        },
      });

      return deleted;
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
    }

    // CONVERTED 계약 건을 소프트 삭제하면 reconcileUserCoupons 가 계약 존재를 판단하는
    // 조건(deletedAt: null)이 깨져 더 이상 계약으로 집계되지 않는다. 그런데 삭제 자체는
    // 쿠폰 테이블을 건드리지 않으므로, 여기서 동기화하지 않으면 회원의 PENDING 쿠폰이
    // 그대로 남아 이미 사라진 계약 건으로 어드민 지급 대기 목록에 계속 노출되고 직원이
    // 실수로 지급할 수 있다. PATCH 핸들러의 훅과 동일하게 트랜잭션 밖, 삭제 성공이
    // 확정된 뒤에만 동기화하고, 실패해도 삭제 응답에는 영향을 주지 않는다.
    if (quote?.status === "CONVERTED" && quote.userId) {
      try {
        const member = await prisma.user.findUnique({
          where: { supabaseId: quote.userId },
          select: { id: true, supabaseId: true, profileCompleted: true },
        });
        if (member?.supabaseId) {
          await reconcileUserCoupons({
            id: member.id,
            supabaseId: member.supabaseId,
            profileCompleted: member.profileCompleted,
          });
        }
      } catch (err) {
        console.error("[DELETE /api/admin/quotes/[id]] 쿠폰 동기화 실패:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/quotes/[id]]", err);
    return NextResponse.json({ error: "견적을 삭제하는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
