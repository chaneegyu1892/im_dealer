import { z } from "zod";
import type { EasyAuthInput } from "@/lib/codef/easyauth";

/**
 * 간편인증 start/complete 라우트 공용 입력 스키마.
 * 서버는 세션을 보관하지 않으므로, 1차 입력값을 2차(complete)에도 그대로 다시 받는다.
 *
 * 이 요청은 임의 전화번호로 인증 푸시를 발송하는 유료 외부 API 호출이다.
 * 스팸·스피어 피싱(타인 번호로 인증 요청 반복)과 초대형 페이로드가
 * 그대로 Codef 로 전송되지 않도록 형식·길이를 서버에서 강제한다.
 * 값 집합은 EasyAuthStep/EasyAuthProviderSelection 이 실제 전송하는 값과 1:1.
 */
const easyAuthFieldsObject = z.object({
  verificationId: z.string().min(1),
  docType: z.enum([
    "biz_registration_proof",
    "income_proof",
    "income_withholding",
    "vat_taxbase",
    "financial_statements",
  ]),
  userName: z.string().min(1).max(50),
  phoneNo: z.string().regex(/^01[016789]\d{7,8}$/),
  // 1 카카오 · 5 통신사 PASS · 6 네이버 · 8 토스
  loginTypeLevel: z.enum(["1", "5", "6", "8"]),
  id: z.string().min(1),
  birthDate: z.string().regex(/^\d{8}$/).optional(),
  // 통신사 PASS(5) 전용 — 0 SKT · 1 KT · 2 LGU+
  telecom: z.enum(["0", "1", "2"]).optional(),
  // 소득증명 연도(4자리) 또는 과세기간·결산월(6자리)
  taxStartMonth: z.string().regex(/^\d{4,6}$/).optional(),
  taxEndMonth: z.string().regex(/^\d{4,6}$/).optional(),
});

// 통신사 PASS 는 telecom 필수 — codef/easyauth.ts 명세. extend 후에도 재적용한다.
const easyAuthPassRule: z.SuperRefinement<{
  loginTypeLevel: string;
  telecom?: string;
}> = (v, ctx) => {
  if (v.loginTypeLevel === "5" && v.telecom === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["telecom"],
      message: "통신사 PASS 인증에는 telecom 이 필요합니다.",
    });
  }
};

// complete 라우트는 twoWayInfo 를 extend 한 뒤 같은 규칙을 다시 적용한다.
export const easyAuthFieldsBase = easyAuthFieldsObject;
export const easyAuthPassRefinement = easyAuthPassRule;

export const easyAuthFieldsSchema = easyAuthFieldsObject.superRefine(easyAuthPassRule);

export const twoWayInfoSchema = z.object({
  jobIndex: z.number(),
  threadIndex: z.number(),
  jti: z.string(),
  twoWayTimestamp: z.number(),
});

export type EasyAuthFields = z.infer<typeof easyAuthFieldsSchema>;

/** 검증된 입력 → easyauth 라이브러리 입력으로 변환 (verificationId 제외). */
export function toEasyAuthInput(f: EasyAuthFields): EasyAuthInput {
  return {
    docType: f.docType,
    userName: f.userName,
    birthDate: f.birthDate ?? "",
    phoneNo: f.phoneNo,
    loginTypeLevel: f.loginTypeLevel,
    telecom: f.telecom,
    id: f.id,
    taxStartMonth: f.taxStartMonth,
    taxEndMonth: f.taxEndMonth,
  };
}
