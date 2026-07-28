import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/require-user";

// 현재 로그인 사용자 정보 (모든 로그인 회원이 사용).
// Header 등 클라이언트가 어드민 분기·표시명을 결정할 때 호출한다.
// 비로그인 또는 비활성 계정은 401로 처리해 로그인 UI가 인증 상태로 보이지 않게 한다.
export async function GET() {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
  });
}
