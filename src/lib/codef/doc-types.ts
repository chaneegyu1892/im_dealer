import type { CustomerType } from "@/constants/customer-types";

/**
 * Codef 회원 간편인증으로 발급받는 공문서 종류.
 *
 * 엔드포인트·기관코드·PDF 필드는 developer.codef.io 개발가이드(2026-06-25 확인)와
 * 데모 실호출 검증값이다. organization 은 4종 모두 고정값 "0001".
 *
 * 계약 서류 기준(개발요청서):
 *   - 개인        : 소득금액증명원
 *   - 개인사업자  : 사업자등록증명, 부가가치세과세표준증명
 *   - 법인        : 사업자등록증명, 표준재무제표증명, 부가가치세과세표준증명
 *
 * 운전면허는 진위확인(O/X)만 유지하고 문서 수집은 하지 않는다(면허증 발급 상품 없음).
 * 주민등록등본은 계약 서류 목록에 없어 수집하지 않는다.
 */
export type DocType =
  | "biz_registration_proof" // 사업자등록 증명 (홈택스) — 개인 발급 불가
  | "income_proof" // 소득금액증명원 (홈택스)
  | "income_withholding" // 근로소득 원천징수영수증(지급명세서) (홈택스)
  | "vat_taxbase" // 부가가치세 과세표준증명 (홈택스) — 개인(비사업자) 발급 불가
  | "financial_statements"; // 표준재무제표증명 (홈택스) — 개인 발급 불가

export interface DocTypeConfig {
  label: string;
  /** Codef API 경로 (호스트 제외). 운영 https://api.codef.io, 데모 https://development.codef.io */
  endpoint: string;
  /** Codef 기관코드 (4종 모두 고정값 "0001") */
  organization: string;
  /** 원본 PDF 수신 요청 파라미터명 — 상품별로 다름 */
  originParam: "originDataYN" | "originDataYN1";
  /** 원본 PDF(base64) 응답 필드명 — 상품별로 다름 */
  pdfField: "resOriGinalData" | "resOriGinalData1";
}

export const DOC_TYPES: Record<DocType, DocTypeConfig> = {
  biz_registration_proof: {
    label: "사업자등록증명",
    endpoint: "/v1/kr/public/nt/proof-issue/corporate-registration",
    organization: "0001",
    originParam: "originDataYN1",
    pdfField: "resOriGinalData1",
  },
  income_proof: {
    label: "소득금액증명원",
    endpoint: "/v1/kr/public/nt/proof-issue/proof-income",
    organization: "0001",
    originParam: "originDataYN1",
    pdfField: "resOriGinalData1",
  },
  income_withholding: {
    label: "근로소득 원천징수영수증",
    endpoint: "/v1/kr/public/nt/proof-issue/paystatement-income",
    organization: "0001",
    originParam: "originDataYN",
    pdfField: "resOriGinalData",
  },
  vat_taxbase: {
    label: "부가가치세과세표준증명",
    endpoint: "/v1/kr/public/nt/proof-issue/additional-tax-standard",
    organization: "0001",
    originParam: "originDataYN1",
    pdfField: "resOriGinalData1",
  },
  financial_statements: {
    label: "표준재무제표증명",
    endpoint: "/v1/kr/public/nt/proof-issue/standard-financial-statements",
    organization: "0001",
    originParam: "originDataYN1",
    pdfField: "resOriGinalData1",
  },
};

const CUSTOMER_DOC_MAP: Record<CustomerType, DocType[]> = {
  individual: ["income_proof"],
  self_employed: ["biz_registration_proof", "vat_taxbase"],
  corporate: ["biz_registration_proof", "financial_statements", "vat_taxbase"],
  nonprofit: ["biz_registration_proof", "financial_statements", "vat_taxbase"],
};

export function docTypesForCustomer(type: CustomerType): DocType[] {
  return CUSTOMER_DOC_MAP[type];
}
