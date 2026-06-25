import { z } from "zod";
import type { EasyAuthInput } from "@/lib/codef/easyauth";

/**
 * 간편인증 start/complete 라우트 공용 입력 스키마.
 * 서버는 세션을 보관하지 않으므로, 1차 입력값을 2차(complete)에도 그대로 다시 받는다.
 */
export const easyAuthFieldsSchema = z.object({
  verificationId: z.string().min(1),
  docType: z.enum([
    "biz_registration_proof",
    "income_withholding",
    "vat_taxbase",
    "financial_statements",
  ]),
  userName: z.string().min(1),
  phoneNo: z.string().min(1),
  loginTypeLevel: z.string().min(1),
  id: z.string().min(1),
  birthDate: z.string().optional(),
  telecom: z.string().optional(),
  taxStartMonth: z.string().optional(),
  taxEndMonth: z.string().optional(),
});

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
