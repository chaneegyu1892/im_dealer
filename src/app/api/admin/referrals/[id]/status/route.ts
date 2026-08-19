import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { applyReferralStatusAction } from "../../status";

// 원장 상태 변경은 보상 회수·어뷰즈 해제 등 강한 처리라 admin 이상만 허용한다.
// (쿠폰 회수 [id]/revoke 와 동일 기준)
const bodySchema = z.object({
  action: z.enum(["unblock", "revoke"]),
  // 사유 필수 — 감사 로그가 항상 "왜 변경했는지"를 설명해야 한다(쿠폰 revoke 준거).
  reason: z.string().trim().min(1, "처리 사유를 입력해주세요.").max(200),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const raw: unknown = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "처리 사유를 입력해주세요.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await applyReferralStatusAction(
      id,
      parsed.data.action,
      admin!.id,
      parsed.data.reason,
      // 요청당 1행 간신 — 조건부 갱신/삭제가 원자적이라 트랜잭션 불필요.
      prisma
    );

    if (!result.ok && result.reason === "not_found") {
      return NextResponse.json(
        { error: "해당 추천 원장 기록을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    if (!result.ok && result.reason === "invalid_transition") {
      return NextResponse.json(
        {
          error: `현재 상태(${result.status})에서는 이 작업을 수행할 수 없습니다.`,
        },
        { status: 400 }
      );
    }
    if (!result.ok) {
      // conflict — 사전 조회 후 원장 상태가 바뀐 경합. 재시도 유도.
      return NextResponse.json(
        { error: "기록 상태가 방금 변경되었습니다. 목록을 새로고침 후 다시 시도해주세요." },
        { status: 409 }
      );
    }

    await logAdminAction({
      request,
      actor: { id: admin!.id, email: admin!.email },
      action: result.action === "unblock" ? "REFERRAL_UNBLOCKED" : "REFERRAL_REVOKED",
      resource: "Referral",
      targetId: id,
      before: result.before,
      meta: { reason: parsed.data.reason },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/admin/referrals/[id]/status]", err);
    return NextResponse.json(
      { error: "추천 원장 상태 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
