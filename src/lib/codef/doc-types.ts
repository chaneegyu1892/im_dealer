import type { CustomerType } from "@/constants/customer-types";

/**
 * Codef 간편인증으로 발급받는 공문서 종류.
 *
 * 각 문서의 Codef API 경로(endpoint)·기관코드(organization)는
 * docs/codef-document-spec.md(스파이크)에서 확정하기 전까지 "" 로 둔다.
 * label 과 고객유형별 매핑은 이미 확정된 사실이므로 여기서 정의한다.
 */
export type DocType =
  | "resident_register" // 주민등록등본/초본 (정부24)
  | "biz_registration_proof" // 사업자등록증명원 (홈택스/정부24)
  | "income_proof" // 소득금액증명/납세증명 (홈택스)
  | "driving_history"; // 운전경력증명서 (경찰청/정부24)

export interface DocTypeConfig {
  label: string;
  /** Codef API 경로 — 스파이크 확정 전까지 "" */
  endpoint: string;
  /** Codef 기관코드(organization) — 스파이크 확정 전까지 "" */
  organization: string;
}

export const DOC_TYPES: Record<DocType, DocTypeConfig> = {
  resident_register: { label: "주민등록등본", endpoint: "", organization: "" },
  biz_registration_proof: { label: "사업자등록증명원", endpoint: "", organization: "" },
  income_proof: { label: "소득금액증명", endpoint: "", organization: "" },
  driving_history: { label: "운전경력증명서", endpoint: "", organization: "" },
};

const CUSTOMER_DOC_MAP: Record<CustomerType, DocType[]> = {
  individual: ["resident_register", "driving_history", "income_proof"],
  self_employed: [
    "resident_register",
    "biz_registration_proof",
    "driving_history",
    "income_proof",
  ],
  corporate: ["biz_registration_proof"],
};

export function docTypesForCustomer(type: CustomerType): DocType[] {
  return CUSTOMER_DOC_MAP[type];
}
