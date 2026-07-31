import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

// ⚠️ 개발 전용 로그인 — 카카오 OAuth(운영 도메인 리다이렉트) 없이 로컬에서 회원 기능을
// 테스트하기 위한 우회로. NODE_ENV=development 에서만 동작하며, 운영 빌드에선 404.
// DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD 로 Supabase 테스트 계정을 부트스트랩한 뒤 세션을 세팅한다.
//
// body { fresh: true } → profileCompleted=false 로 만들어 간편가입(/welcome) 흐름을 테스트한다.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const fresh = body?.fresh === true;

  const email = process.env.DEV_LOGIN_EMAIL?.trim();
  const password = process.env.DEV_LOGIN_PASSWORD?.trim();
  if (!email || !password) {
    return NextResponse.json(
      { error: "DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD 가 .env 에 설정되어야 합니다." },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // 1) 테스트 auth 계정을 보장한다 (없으면 생성, 있으면 비밀번호를 설정값으로 맞춤).
  let authUserId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.data?.user?.id) {
    authUserId = created.data.user.id;
  } else {
    // 이미 존재 → 목록에서 찾고 비밀번호를 재설정해 로그인이 항상 성공하게 한다.
    const { data: list } = await admin.auth.admin.listUsers();
    const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      authUserId = found.id;
      await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true });
    }
  }
  if (!authUserId) {
    return NextResponse.json({ error: "테스트 계정 생성에 실패했습니다." }, { status: 500 });
  }

  // 2) 세션 발급 (쿠키 세팅) — 서버 클라이언트로 비밀번호 로그인.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: `로그인 실패: ${signInError.message}` }, { status: 500 });
  }

  // 3) 회원 레코드 보장 — 마이페이지·채널추가·마케팅 토글을 테스트할 수 있는 상태로.
  try {
    await prisma.user.upsert({
      where: { supabaseId: authUserId },
      update: {
        lastLoginAt: new Date(),
        // fresh 모드면 간편가입 미완료 상태로 되돌려 /welcome 흐름을 테스트한다.
        profileCompleted: !fresh,
        ...(fresh ? { phone: null, kakaoNickname: "테스트닉네임" } : {}),
      },
      create: {
        supabaseId: authUserId,
        email,
        name: "테스트 회원",
        role: "member",
        provider: "kakao",
        kakaoNickname: fresh ? "테스트닉네임" : null,
        phone: fresh ? null : "010-0000-0000",
        channelRelation: null, // 채널 미추가 → 채널추가 CTA 노출
        marketingConsent: false,
        profileCompleted: !fresh, // fresh=false → 곧바로 마이페이지, true → /welcome 유도
        isActive: true,
        lastLoginAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[dev/login] user upsert failed:", err);
  }

  return NextResponse.json({ success: true });
}
