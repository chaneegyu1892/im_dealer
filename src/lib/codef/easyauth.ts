import { getCodefToken, callCodefRaw } from "@/lib/codef";
import { DOC_TYPES, type DocType } from "@/lib/codef/doc-types";

/**
 * Codef 회원 간편인증(loginType="5") 2-way 발급 래퍼.
 *
 * 흐름:
 *   1) startEasyAuth → 1차 요청 → CF-03002 + twoWayInfo 반환 (사용자 폰 인증 대기)
 *   2) 사용자가 간편인증 앱에서 승인 (타임아웃 4분 30초)
 *   3) completeEasyAuth → 2차 요청(is2Way+twoWayInfo+simpleAuth) → CF-00000 + 원본 PDF
 *
 * 서버는 PII/세션을 보관하지 않는다. twoWayInfo(불투명 토큰)와 입력값을
 * 클라이언트가 2차 호출에 다시 실어 보낸다(Vercel 인스턴스 간 메모리 비공유 회피).
 * 동일 기관 다건 묶음은 동일 `id`(요청 식별 아이디)로 처리한다.
 */

const ADD_AUTH_CODE = "CF-03002"; // 추가인증 필요
const SUCCESS_CODE = "CF-00000"; // 정상 완료

export interface EasyAuthInput {
  docType: DocType;
  userName: string;
  /** 생년월일 8자리 YYYYMMDD — 홈택스 회원 간편인증 본인확인값 */
  birthDate: string;
  phoneNo: string;
  /** 간편인증 제공자: 1 카카오톡, 5 통신사(PASS), 6 네이버, 8 toss … */
  loginTypeLevel: string;
  /** PASS(loginTypeLevel="5")일 때 필수: "0"SKT "1"KT "2"LGU+ */
  telecom?: string;
  /** 요청 식별 아이디 — 동일 기관 다건 묶음을 위한 세션 키 */
  id: string;
  /**
   * 과세기간 시작(yyyyMM). docType 별 의미가 다르다.
   *  - income_proof: 귀속연도(yyyy)
   *  - vat_taxbase: 기수 코드(MM="01" 1기 / "07" 2기)
   *  - financial_statements: 사업종료년월(예: "202312")
   * docType 을 아는 클라이언트(EasyAuthStep)가 계산해 주입한다.
   */
  taxStartMonth?: string;
  /** 과세기간 종료. income_proof 는 yyyy, vat_taxbase 는 yyyyMM(보통 start 와 동일 기수). */
  taxEndMonth?: string;
}

/** 1차 응답의 불투명 토큰. 비-PII. 클라이언트가 2차 호출에 echo. */
export interface TwoWayInfo {
  jobIndex: number;
  threadIndex: number;
  jti: string;
  twoWayTimestamp: number;
}

export type StartResult =
  | { kind: "2way"; twoWayInfo: TwoWayInfo }
  | { kind: "error"; code?: string; error: string };

export interface IssuedDoc {
  success: boolean;
  pdfBase64: string | null;
  docVerifyNo: string | null;
  error?: string;
  code?: string;
}

/** 1차 요청 파라미터 (회원 간편인증 loginType="5") */
export function buildBaseParams(input: EasyAuthInput): Record<string, unknown> {
  const cfg = DOC_TYPES[input.docType];
  const base: Record<string, unknown> = {
    organization: cfg.organization,
    loginType: "5",
    loginTypeLevel: input.loginTypeLevel,
    userName: input.userName,
    id: input.id,
    [cfg.originParam]: "1",
  };
  if (input.telecom) base.telecom = input.telecom;

  switch (input.docType) {
    case "biz_registration_proof":
      base.phoneNo = input.phoneNo;
      base.loginIdentity = input.birthDate; // 회원(5) = 생년월일 8자리
      base.usePurposes = "07"; // 금융기관제출용
      base.submitTargets = "01"; // 금융기관
      base.isIdentityViewYN = "0";
      break;
    case "income_proof":
      base.phoneNo = input.phoneNo;
      base.loginIdentity = input.birthDate;
      base.usePurposes = "07";
      base.submitTargets = "01";
      if (input.taxStartMonth) base.startYear = input.taxStartMonth;
      if (input.taxEndMonth) base.endYear = input.taxEndMonth;
      break;
    case "income_withholding":
      // 근로소득 지급명세서: 본인확인 필드명이 'identity'(값은 생년월일 8자리).
      base.phoneNo = input.phoneNo;
      base.identity = input.birthDate;
      // inquiryType 미지정 → 최근 귀속년도 자동 조회.
      break;
    case "vat_taxbase":
      base.phoneNo = input.phoneNo;
      base.loginIdentity = input.birthDate;
      base.usePurposes = "07";
      base.submitTargets = "01";
      base.isIdentityViewYN = "0";
      // 과세기간(기수 코드 yyyyMM) — 필수(O).
      if (input.taxStartMonth) base.startDate = input.taxStartMonth;
      if (input.taxEndMonth) base.endDate = input.taxEndMonth;
      break;
    case "financial_statements":
      // 재무제표: 전화번호 필드명이 'loginPhoneNo'.
      base.loginPhoneNo = input.phoneNo;
      base.loginIdentity = input.birthDate;
      base.usePurposes = "07";
      base.submitTargets = "01";
      base.isIdentityViewYN = "0";
      // 사업종료년월(yyyyMM) — 법인 필수(O).
      if (input.taxStartMonth) base.startDate = input.taxStartMonth;
      break;
  }
  return base;
}

function toTwoWayInfo(data: unknown): TwoWayInfo | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (
    typeof d.jobIndex === "number" &&
    typeof d.threadIndex === "number" &&
    typeof d.jti === "string" &&
    (typeof d.twoWayTimestamp === "number" || typeof d.twoWayTimestamp === "string")
  ) {
    return {
      jobIndex: d.jobIndex,
      threadIndex: d.threadIndex,
      jti: d.jti,
      twoWayTimestamp: Number(d.twoWayTimestamp),
    };
  }
  return null;
}

/** 1차 요청 — 간편인증 푸시 발송 후 twoWayInfo 반환 */
export async function startEasyAuth(input: EasyAuthInput): Promise<StartResult> {
  const token = await getCodefToken();
  if (!token.success) return { kind: "error", error: token.error };

  const cfg = DOC_TYPES[input.docType];
  const res = await callCodefRaw(cfg.endpoint, buildBaseParams(input), token.data);
  if (!res.success) return { kind: "error", error: res.error };

  if (res.data.code === ADD_AUTH_CODE) {
    const twoWayInfo = toTwoWayInfo(res.data.data);
    if (!twoWayInfo) {
      return { kind: "error", code: res.data.code, error: "추가인증 정보(twoWayInfo) 파싱 실패" };
    }
    return { kind: "2way", twoWayInfo };
  }

  return {
    kind: "error",
    code: res.data.code,
    error: `예상치 못한 응답 [${res.data.code}]: ${res.data.message}`,
  };
}

/** 2차 요청 — 사용자 인증 완료 후 문서(PDF) 수신 */
export async function completeEasyAuth(
  input: EasyAuthInput,
  twoWayInfo: TwoWayInfo
): Promise<IssuedDoc> {
  const token = await getCodefToken();
  if (!token.success) {
    return { success: false, pdfBase64: null, docVerifyNo: null, error: token.error };
  }

  const cfg = DOC_TYPES[input.docType];
  const params = {
    ...buildBaseParams(input),
    is2Way: true,
    twoWayInfo,
    simpleAuth: "1", // 사용자 인증 완료 신호
  };

  const res = await callCodefRaw(cfg.endpoint, params, token.data);
  if (!res.success) {
    return { success: false, pdfBase64: null, docVerifyNo: null, error: res.error };
  }

  if (res.data.code !== SUCCESS_CODE) {
    return {
      success: false,
      pdfBase64: null,
      docVerifyNo: null,
      code: res.data.code,
      error: `발급 실패 [${res.data.code}]: ${res.data.message}`,
    };
  }

  // 단건은 객체, 다건은 리스트. 첫 항목을 사용.
  const raw = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
  const obj = (raw ?? {}) as Record<string, unknown>;

  const pdf = obj[cfg.pdfField];
  const docVerifyNo = obj.resIssueNo;

  return {
    success: true,
    pdfBase64: typeof pdf === "string" && pdf.length > 0 ? pdf : null,
    docVerifyNo: typeof docVerifyNo === "string" && docVerifyNo.length > 0 ? docVerifyNo : null,
  };
}
