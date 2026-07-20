// 카카오 사용자 정보 조회 — 카카오싱크 간편가입으로 동의받은 항목을 한 번에 읽는다.
// 카카오 API: GET https://kapi.kakao.com/v2/user/me (Bearer = provider_token)
// 미동의 항목은 응답에 아예 없거나 빈 값 → 전부 optional 로 다룬다(로그인 흐름을 막지 않는다).

import { z } from "zod";

export interface KakaoAccount {
  readonly kakaoId: string | null;
  /** 카카오 "+82 10-1234-5678" 원본 형태. 저장은 원본, 외부 전달 시 toE164KR 로 정규화. */
  readonly phone: string | null;
  /** 동의항목 "이름"으로 받은 실명. 닉네임과 별개. */
  readonly name: string | null;
  readonly email: string | null;
}

const kakaoAccountResponseSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  kakao_account: z
    .object({
      phone_number: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
});

const serviceTermsResponseSchema = z.object({
  service_terms: z
    .array(
      z.object({
        tag: z.string().optional(),
        agreed: z.boolean().optional(),
      })
    )
    .optional(),
});

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** /v2/user/me 응답에서 필요한 필드만 뽑아낸다(순수 함수). */
export function parseKakaoAccount(json: unknown): KakaoAccount {
  const result = kakaoAccountResponseSchema.safeParse(json);
  if (!result.success) {
    return { kakaoId: null, phone: null, name: null, email: null };
  }
  const account = result.data.kakao_account;

  return {
    kakaoId:
      typeof result.data.id === "number"
        ? String(result.data.id)
        : str(result.data.id),
    phone: str(account?.phone_number),
    name: str(account?.name),
    email: str(account?.email),
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
  } catch (error) {
    if (error instanceof Error) {
      console.error("[kakao] fetchKakaoAccount failed:", error);
      return null;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 서비스 약관 동의 내역 — 간편가입 동의창에서 체크한 자체 약관을 조회한다.
// 카카오 API: GET https://kapi.kakao.com/v1/user/service/terms
// 응답 예: { service_terms: [ { tag: "marketing", agreed: true, agreed_at } ] }

/** 동의한 약관의 tag 목록을 뽑아낸다(순수 함수). */
export function parseAgreedTermTags(json: unknown): string[] {
  const result = serviceTermsResponseSchema.safeParse(json);
  if (!result.success || !result.data.service_terms) return [];

  return result.data.service_terms
    .filter((term) => term.agreed === true)
    .map((term) => str(term.tag))
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
  } catch (error) {
    if (error instanceof Error) {
      console.error("[kakao] fetchAgreedTermTags failed:", error);
      return [];
    }
    throw error;
  }
}
