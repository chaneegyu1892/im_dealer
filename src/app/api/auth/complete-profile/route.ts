import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/admin-auth";
import { toDomesticKR } from "@/lib/phone";
import { manualReferralClaim } from "@/lib/referral/manual-claim";
import { getClientIp, hashIp } from "@/lib/ip-hash";

// 간편가입 완료: 로그인 회원의 이름·전화(필수)와 마케팅 동의(선택)를 저장하고
// profileCompleted 를 true 로 표시한다. /welcome 폼에서 호출한다.
// 추천인 코드(선택)는 등록을 방해하지 않는 부가 기능으로 여기서 함께 처리한다.
const schema = z.object({
  name: z.string().trim().min(2, "이름을 2자 이상 입력해주세요.").max(20),
  phone: z.string().trim().min(1, "전화번호를 입력해주세요."),
  marketingConsent: z.boolean().default(false),
  referralCode: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const phone = toDomesticKR(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)" },
      { status: 400 }
    );
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        phone,
        marketingConsent: parsed.data.marketingConsent,
        profileCompleted: true,
      },
    });
  } catch (err) {
    console.error("[POST /api/auth/complete-profile]", err);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 추천인 코드 등록은 부가 기능이다. 실패하거나 거부돼도 프로필 완료는 그대로 성공한다.
  if (parsed.data.referralCode) {
    try {
      const rawIp = getClientIp(request);
      // IP 임계에 무헤더 요청들이 같은 해시로 뭉치지 않도록 원본이 없으면 아예 넘기지 않는다.
      const ipHash = rawIp && rawIp !== "unknown" ? hashIp(rawIp) : null;
      const result = await manualReferralClaim({
        user,
        referralCode: parsed.data.referralCode,
        ipHash,
      });
      if (result.precheck === "ok") {
        const { attribution } = result;
        if (attribution && attribution.status !== "REWARDED") {
          // 사유 코드만 남긴다. 코드·전화·이메일·IP 는 로그에 싣지 않는다.
          console.warn(
            `[POST /api/auth/complete-profile] referral not rewarded: ${attribution.status}/${attribution.reason ?? "none"}`
          );
        }
      } else if (result.precheck === "rejected") {
        console.warn(
          `[POST /api/auth/complete-profile] referral rejected: ${result.rejection ?? "unknown"}`
        );
      }
    } catch (err) {
      // 등록 실패가 프로필 완료를 막지 않는다.
      console.error("[POST /api/auth/complete-profile] referral attribution failed");
    }
  }

  return NextResponse.json({ success: true });
}
