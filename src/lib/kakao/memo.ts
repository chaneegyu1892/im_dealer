// 카카오톡 "나에게 보내기" — 로그인 회원 본인의 카카오톡으로 견적서를 보낸다.
// 카카오 API: POST https://kapi.kakao.com/v2/api/talk/memo/default/send
// 필요 스코프: talk_message
//
// 대행사·발신프로필·템플릿 심사가 필요 없고, 수신자가 본인이라 광고성 규제도 적용되지 않는다.
// 채널에서 보내는 친구톡으로 바꿀 땐 이 모듈만 교체하면 된다(호출측 계약 동일).

const MEMO_ENDPOINT = "https://kapi.kakao.com/v2/api/talk/memo/default/send";

export interface QuoteMemoParams {
  accessToken: string;
  vehicleName: string;
  /** 카카오 서버가 직접 가져가므로 인증 없이 접근 가능해야 한다. */
  imageUrl: string;
  /** 견적 상세로 돌아오는 링크. 카카오 콘솔에 등록된 도메인이어야 한다. */
  linkUrl: string;
}

export interface MemoSendResult {
  ok: boolean;
  /** 실패 사유(로그·DB 기록용). 성공 시 null. */
  reason: string | null;
}

function buildTemplate(params: QuoteMemoParams) {
  const link = { web_url: params.linkUrl, mobile_web_url: params.linkUrl };
  return {
    object_type: "feed",
    content: {
      title: `${params.vehicleName} 견적서`,
      description: "선택하신 조건으로 계산된 견적서입니다.",
      image_url: params.imageUrl,
      link,
    },
    buttons: [{ title: "견적서 자세히 보기", link }],
  };
}

export async function sendQuoteMemo(params: QuoteMemoParams): Promise<MemoSendResult> {
  try {
    const res = await fetch(MEMO_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        template_object: JSON.stringify(buildTemplate(params)),
      }),
    });

    if (!res.ok) {
      // 카카오는 실패 사유를 본문에 담아준다(스코프 미동의, 토큰 만료 등).
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: `HTTP ${res.status} ${detail}`.trim() };
    }

    return { ok: true, reason: null };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "unknown error" };
  }
}
