// 카카오 로그인 요청 스코프 — 로그인 버튼과 콜백이 같은 기준을 보도록 한곳에 모은다.
//
// NEXT_PUBLIC_KAKAO_SYNC=true 는 카카오싱크(간편가입) 모드.
// 콘솔에서 해당 동의항목이 "승인" 상태가 아닐 때 켜면 로그인 자체가 깨지므로,
// 심사 승인 후에만 켠다(끄면 기존 프로필-only 로그인으로 즉시 롤백).

const BASE_SCOPES = ["profile_nickname", "profile_image"] as const;

// 간편가입으로 추가 수집하는 항목.
// ⚠️ 여기 넣는 스코프는 하나라도 콘솔에 미설정이면 로그인 전체가 KOE205 로 실패한다.
//    반드시 콘솔 동의항목 설정·승인을 먼저 확인하고 추가할 것.
//
// talk_message = "나에게 보내기"(견적서 전송) 권한
//
// plusfriends(카카오톡 채널 관계 확인)는 콘솔 미설정으로 제외했다.
// 설정 후 다시 추가하면 getChannelRelation() 이 동작한다.
// 없는 동안엔 User.channelRelation 이 null 로 남고, marketingConsent 는 약관 tag 로만 판정된다.
const SYNC_SCOPES = ["account_email", "name", "phone_number", "talk_message"] as const;

export function isKakaoSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KAKAO_SYNC === "true";
}

export function getKakaoScopes(): string {
  const scopes = isKakaoSyncEnabled() ? [...BASE_SCOPES, ...SYNC_SCOPES] : BASE_SCOPES;
  return scopes.join(",");
}
