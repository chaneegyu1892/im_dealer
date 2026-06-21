import type { CustomerType } from "@/constants/customer-types";

/**
 * Codef 간편인증으로 발급받는 공문서 종류.
 *
 * 엔드포인트·기관코드·PDF 필드는 docs/codef-document-spec.md(스파이크, 2026-06-22)
 * 에서 developer.codef.io 개발가이드로 직접 확인한 실제 값이다.
 * 운전면허는 기존 진위확인(O/X) 플로우만 유지하고 문서 수집은 하지 않는다
 * (운전경력증명서는 Codef 상품에 없음).
 */
export type DocType =
  | "resident_register" // 주민등록등본 교부 (정부24)
  | "biz_registration_proof" // 사업자등록 증명 (홈택스) — 개인 발급 불가
  | "income_proof"; // 증명발급 소득금액증명원 (홈택스)

export interface DocTypeConfig {
  label: string;
  /** Codef API 경로 (호스트 제외). 운영 https://api.codef.io, 데모 https://development.codef.io */
  endpoint: string;
  /** Codef 기관코드 (3종 모두 고정값 "0001") */
  organization: string;
  /** 원본 PDF 수신 요청 파라미터명 — 상품별로 다름 */
  originParam: "originDataYN" | "originDataYN1";
  /** 원본 PDF(base64) 응답 필드명 — 상품별로 다름 */
  pdfField: "resOriGinalData" | "resOriGinalData1";
}

export const DOC_TYPES: Record<DocType, DocTypeConfig> = {
  resident_register: {
    label: "주민등록등본",
    endpoint: "/v1/kr/public/mw/resident-registration-copy/issuance",
    organization: "0001",
    originParam: "originDataYN",
    pdfField: "resOriGinalData",
  },
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
};

const CUSTOMER_DOC_MAP: Record<CustomerType, DocType[]> = {
  individual: ["resident_register", "income_proof"],
  self_employed: ["resident_register", "biz_registration_proof", "income_proof"],
  corporate: ["biz_registration_proof"],
};

export function docTypesForCustomer(type: CustomerType): DocType[] {
  return CUSTOMER_DOC_MAP[type];
}
