import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/admin-auth";
import { manualReferralClaim } from "@/lib/referral/manual-claim";
import { getClientIp, hashIp } from "@/lib/ip-hash";

// 회원이 추천인 코드를 직접 제출해 등록하는 경로. 가입 직후(/welcome)가 아니라
// 나중에 별도로 코드를 입력하는 경우를 위한 것이다. 가드는 manualReferralClaim 이
// 형식·이미 귀속·7일 기간·자기추천·월한도·IP 임계를 전부 강제한다.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const referralCode =
    typeof body?.referralCode === "string" ? body.referralCode : "";

  try {
    const rawIp = getClientIp(request);
    const ipHash = rawIp && rawIp !== "unknown" ? hashIp(rawIp) : null;
    const result = await manualReferralClaim({ user, referralCode, ipHash });

    if (result.precheck === "rejected") {
      // 사유는 코드만 노출한다(PII 없음).
      switch (result.rejection) {
        case "already_attributed":
          return NextResponse.json(
            { error: "이미 추천인 혜택을 받았습니다." },
            { status: 409 }
          );
        case "expired":
          return NextResponse.json(
            { error: "가입 후 7일이 지나 추천인 코드를 등록할 수 없습니다." },
            { status: 400 }
          );
        default:
          return NextResponse.json(
            { error: "알 수 없는 추천인 코드입니다." },
            { status: 400 }
          );
      }
    }

    const attribution = result.attribution;
    if (attribution?.status === "REWARDED") {
      return NextResponse.json({ success: true });
    }
    if (attribution?.status === "BLOCKED") {
      // 자기추천은 명확히 안내하고, 나머지(월한도·IP 임계)는 범용 문구로 처리한다.
      return NextResponse.json(
        {
          error:
            attribution.reason === "self_referral"
              ? "본인 추천 코드는 사용할 수 없어요."
              : "추천인 코드를 등록할 수 없습니다.",
        },
        { status: 400 }
      );
    }
    // SKIPPED — 추천인 없음/비활성/또 다른 사유.
    return NextResponse.json(
      { error: "알 수 없는 추천인 코드입니다." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[POST /api/referral/claim] attribution failed:", err);
    return NextResponse.json(
      { error: "추천인 코드 등록에 실패했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
