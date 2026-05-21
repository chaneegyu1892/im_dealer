import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/admin-auth";

// 현재 로그인 사용자 정보 (모든 로그인 회원이 사용).
// Header 등 클라이언트가 어드민 분기·표시명을 결정할 때 호출한다.
// 비로그인은 401, 로그인 + 비활성 계정은 200이지만 isActive=false 로 응답하여 UI에서 처리.
export async function GET() {
  const user = await getCurrentUser();
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
