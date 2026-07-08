import { describe, it, expect } from "vitest";
import { easyAuthFieldsSchema, twoWayInfoSchema, toEasyAuthInput } from "./validation";

describe("easyAuthFieldsSchema", () => {
  const valid = {
    verificationId: "v1",
    docType: "biz_registration_proof",
    userName: "홍길동",
    phoneNo: "01012345678",
    loginTypeLevel: "1",
    id: "sess-1",
  };

  it("필수값만으로 통과한다", () => {
    expect(easyAuthFieldsSchema.safeParse(valid).success).toBe(true);
  });

  it("알 수 없는 docType 은 거부한다", () => {
    expect(easyAuthFieldsSchema.safeParse({ ...valid, docType: "driving_history" }).success).toBe(
      false
    );
  });

  it("소득금액증명원 docType 을 허용한다", () => {
    expect(easyAuthFieldsSchema.safeParse({ ...valid, docType: "income_proof" }).success).toBe(
      true
    );
  });

  it("verificationId 누락 시 거부한다", () => {
    const { verificationId, ...rest } = valid;
    void verificationId;
    expect(easyAuthFieldsSchema.safeParse(rest).success).toBe(false);
  });
});

describe("twoWayInfoSchema", () => {
  it("4개 토큰 필드를 요구한다", () => {
    expect(
      twoWayInfoSchema.safeParse({ jobIndex: 0, threadIndex: 0, jti: "x", twoWayTimestamp: 1 })
        .success
    ).toBe(true);
    expect(twoWayInfoSchema.safeParse({ jobIndex: 0 }).success).toBe(false);
  });
});

describe("toEasyAuthInput", () => {
  it("birthDate 미제공 시 빈 문자열로 채운다", () => {
    const input = toEasyAuthInput(easyAuthFieldsSchema.parse({
      verificationId: "v1",
      docType: "biz_registration_proof",
      userName: "홍길동",
      phoneNo: "01012345678",
      loginTypeLevel: "1",
      id: "sess-1",
    }));
    expect(input.birthDate).toBe("");
    expect(input.docType).toBe("biz_registration_proof");
  });

  it("서류 발급 기간(taxStartMonth/taxEndMonth)을 전달한다", () => {
    const input = toEasyAuthInput(easyAuthFieldsSchema.parse({
      verificationId: "v1",
      docType: "income_proof",
      userName: "홍길동",
      phoneNo: "01012345678",
      loginTypeLevel: "1",
      id: "sess-1",
      taxStartMonth: "2025",
      taxEndMonth: "2025",
    }));
    expect(input.taxStartMonth).toBe("2025");
    expect(input.taxEndMonth).toBe("2025");
  });
});
