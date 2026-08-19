import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import { reconcileCouponsForQuoteOwner } from "@/lib/coupons/reconcile";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * 회원 본인 저장 견적 soft-delete.
 * SavedQuote.userId 는 Supabase auth user id 를 저장한다.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireActiveUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "잘못된 견적 ID입니다." }, { status: 400 });
  }

  const supabaseId = auth.user.supabaseId;
  if (!supabaseId) {
    return NextResponse.json({ error: "계정 연결 정보가 없습니다." }, { status: 403 });
  }

  const existing = await prisma.savedQuote.findFirst({
    where: { id, userId: supabaseId, deletedAt: null },
    // 삭제 후 쿠폰 동기화(CONVERTED 여부 판단)에 쓸 스냅숏을 함께 읽는다.
    select: { id: true, userId: true, status: true },
  });

  if (!existing) {
    // 이미 삭제됐거나 소유가 아니면 동일하게 404 (존재 여부 누설 최소화)
    return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.savedQuote.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  // 어드민 DELETE(/api/admin/quotes/[id]) 와 동일한 훅: 회원이 직접 CONVERTED
  // 계약 견적을 지우면 reconcileUserCoupons 의 계약 존재 판단(deletedAt: null)이
  // 깨지므로 PENDING 쿠폰을 HELD 로 되돌려야 한다. 소유자뿐 아니라 이 회원을 추천한
  // 추천인의 REFERRAL_GIVEN 까지 함께 동기화한다(reconcileCouponsForQuoteOwner).
  // 트랜잭션(단일 update) 밖, 삭제 확정 후에만 호출하고 실패해도 삭제 응답을
  // 되돌리지 않는다 — 동기화는 다음 방문·어드민 조작 시 다시 맞춰진다.
  if (existing.status === "CONVERTED" && existing.userId) {
    try {
      await reconcileCouponsForQuoteOwner(existing.userId);
    } catch (err) {
      console.error("[DELETE /api/me/quotes/[id]] 쿠폰 동기화 실패:", err);
    }
  }

  return NextResponse.json({ success: true });
}
