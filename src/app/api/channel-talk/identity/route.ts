import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getCurrentUser } from "@/lib/admin-auth";
import { toE164KR } from "@/lib/phone";

// 채널톡 boot 에 전달할 로그인 회원 신원 정보.
// 로그인 회원 → memberId(User.id, 예측 불가한 cuid) + memberHash + profile.
// 비로그인 → { anonymous: true } (memberId 미전달 → 채널톡이 익명 리드로 처리).
//
// 방법 2(웹-카카오 1회 연동)의 전제 조건: 로그인 시 memberId 가 채널톡으로 전달되어야
// 이후 카카오 아이콘 경로로 유니피케이션(익명 → 회원 통합)이 동작한다.
export async function GET() {
  const secret = process.env.CHANNEL_TALK_SECRET_KEY;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ anonymous: true });
  }

  // memberHash: HMAC-SHA256(memberId) — 키는 채널 시크릿키를 hex 디코딩한 바이트(채널톡 스펙).
  // 시크릿키는 서버에만 존재. 미설정 시에도 유니피케이션 자체는 memberId 로 동작하므로 hash 는 생략한다.
  const memberHash = secret
    ? createHmac("sha256", Buffer.from(secret, "hex")).update(user.id).digest("hex")
    : undefined;

  const mobileNumber = toE164KR(user.phone);

  return NextResponse.json({
    anonymous: false,
    memberId: user.id,
    ...(memberHash ? { memberHash } : {}),
    profile: {
      name: user.name,
      ...(user.email ? { email: user.email } : {}),
      ...(mobileNumber ? { mobileNumber } : {}),
    },
  });
}
