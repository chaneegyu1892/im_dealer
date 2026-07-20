// 카카오 사용자 정보 조회 — 카카오싱크 간편가입으로 동의받은 항목을 한 번에 읽는다.
// 카카오 API: GET https://kapi.kakao.com/v2/user/me (Bearer = provider_token)
// 미동의 항목은 응답에 아예 없거나 빈 값 → 전부 optional 로 다룬다(로그인 흐름을 막지 않는다).

export interface KakaoAccount {
  kakaoId: string | null;
  /** 카카오 "+82 10-1234-5678" 원본 형태. 저장은 원본, 외부 전달 시 toE164KR 로 정규화. */
  phone: string | null;
  /** 동의항목 "이름"으로 받은 실명. 닉네임과 별개. */
  name: string | null;
  email: string | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** /v2/user/me 응답에서 필요한 필드만 뽑아낸다(순수 함수). */
export function parseKakaoAccount(json: unknown): KakaoAccount {
  const root = (json ?? {}) as { id?: unknown; kakao_account?: unknown };
  const account = (root.kakao_account ?? {}) as Record<string, unknown>;

  return {
    kakaoId: typeof root.id === "number" ? String(root.id) : str(root.id),
    phone: str(account.phone_number),
    name: str(account.name),
    email: str(account.email),
  };
}

export async function fetchKakaoAccount(providerToken: string): Promise<KakaoAccount | null> {
  if (!providerToken) return null;
  try {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!res.ok) return null;
    return parseKakaoAccount(await res.json());
  } catch (err) {
    console.error("[kakao] fetchKakaoAccount failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 서비스 약관 동의 내역 — 간편가입 동의창에서 체크한 자체 약관을 조회한다.
// 카카오 API: GET https://kapi.kakao.com/v1/user/service/terms
// 응답 예: { service_terms: [ { tag: "marketing", agreed: true, agreed_at } ] }

/** 동의한 약관의 tag 목록을 뽑아낸다(순수 함수). */
export function parseAgreedTermTags(json: unknown): string[] {
  const terms = (json as { service_terms?: unknown })?.service_terms;
  if (!Array.isArray(terms)) return [];

  return terms
    .filter((t) => (t as { agreed?: unknown })?.agreed === true)
    .map((t) => str((t as { tag?: unknown })?.tag))
    .filter((tag): tag is string => tag !== null);
}

/** 실패 시 빈 배열(로그인 흐름을 막지 않는다). */
export async function fetchAgreedTermTags(providerToken: string): Promise<string[]> {
  if (!providerToken) return [];
  try {
    const res = await fetch("https://kapi.kakao.com/v1/user/service/terms", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!res.ok) return [];
    return parseAgreedTermTags(await res.json());
  } catch (err) {
    console.error("[kakao] fetchAgreedTermTags failed:", err);
    return [];
  }
}
