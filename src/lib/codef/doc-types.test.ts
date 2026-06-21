import { describe, it, expect } from "vitest";
import { DOC_TYPES, docTypesForCustomer, type DocType } from "@/lib/codef/doc-types";
import { CUSTOMER_TYPES } from "@/constants/customer-types";

describe("doc-types", () => {
  it("개인은 등본·소득금액증명원을 수집한다", () => {
    expect(docTypesForCustomer("individual")).toEqual([
      "resident_register",
      "income_proof",
    ]);
  });

  it("개인사업자는 등본·사업자증명·소득금액증명원을 수집한다", () => {
    expect(docTypesForCustomer("self_employed")).toEqual([
      "resident_register",
      "biz_registration_proof",
      "income_proof",
    ]);
  });

  it("법인은 사업자등록증명만 수집한다", () => {
    expect(docTypesForCustomer("corporate")).toEqual(["biz_registration_proof"]);
  });

  it("모든 고객유형은 최소 1개 문서를 매핑한다", () => {
    CUSTOMER_TYPES.forEach((t) => {
      expect(docTypesForCustomer(t).length).toBeGreaterThan(0);
    });
  });

  it("매핑된 모든 DocType 은 endpoint·organization·pdf 필드를 가진다", () => {
    const all = new Set<DocType>();
    CUSTOMER_TYPES.forEach((t) => docTypesForCustomer(t).forEach((d) => all.add(d)));
    all.forEach((d) => {
      const cfg = DOC_TYPES[d];
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.endpoint.startsWith("/v1/kr/public/")).toBe(true);
      expect(cfg.organization).toBe("0001");
      expect(cfg.pdfField).toMatch(/^resOriGinalData1?$/);
    });
  });
});
