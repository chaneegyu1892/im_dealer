import { describe, expect, it } from "vitest";
import { sanitizeCaptureRecord } from "./capture-policy.mjs";

describe("sanitizeCaptureRecord", () => {
  it("로그인 요청은 캡처하지 않는다", () => {
    expect(
      sanitizeCaptureRecord({
        path: "/com/login.act",
        payload: "usrId=dealer&usrPw=top-secret",
        resp: "{\"accessToken\":\"token\"}",
      })
    ).toBeNull();
  });

  it("JSON 요청과 응답의 민감정보를 마스킹한다", () => {
    const record = sanitizeCaptureRecord({
      path: "/SIT0001.act",
      payload: JSON.stringify({
        txGbCd: "CALC",
        password: "top-secret",
        nested: { sessionToken: "session-secret" },
      }),
      resp: JSON.stringify({ monthly: 551000, accessToken: "access-secret" }),
    });

    expect(record).not.toBeNull();
    expect(record?.payload).toContain("\"password\":\"[REDACTED]\"");
    expect(record?.payload).toContain("\"sessionToken\":\"[REDACTED]\"");
    expect(record?.resp).toContain("\"accessToken\":\"[REDACTED]\"");
    expect(record?.resp).toContain("\"monthly\":551000");
    expect(JSON.stringify(record)).not.toContain("top-secret");
    expect(JSON.stringify(record)).not.toContain("session-secret");
    expect(JSON.stringify(record)).not.toContain("access-secret");
  });

  it("form-urlencoded 요청의 비밀번호를 마스킹한다", () => {
    const record = sanitizeCaptureRecord({
      path: "/SIT0001.act",
      payload: "txGbCd=CALC&usrPw=top-secret&amount=1000",
      resp: "",
    });

    expect(record?.payload).toContain("usrPw=%5BREDACTED%5D");
    expect(record?.payload).toContain("amount=1000");
    expect(record?.payload).not.toContain("top-secret");
  });
});
