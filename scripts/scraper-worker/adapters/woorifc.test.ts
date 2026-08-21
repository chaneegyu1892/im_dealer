import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeWoorifcResponse, WOORIFC_MAX_DECODED_RESPONSE_BYTES } from "./woorifc";

function encodeResponse(value: unknown): string {
  return deflateSync(Buffer.from(JSON.stringify(value), "utf8")).toString("base64");
}

describe("WOORIFC response decoder", () => {
  it("decodes a raw base64+zlib JSON response", () => {
    const raw = encodeResponse({ rspn_cd: "0000", cost: { pymt_amt: "123456" } });

    expect(decodeWoorifcResponse(raw)).toEqual({ rspn_cd: "0000", cost: { pymt_amt: "123456" } });
  });

  it("decodes the JSON rtnData wrapper used by rentRemain and costData", () => {
    const payload = { rspn_cd: "0000", remain: { "36": { "7": 62 } } };
    const raw = JSON.stringify({ rtnData: encodeResponse(payload) });

    expect(decodeWoorifcResponse(raw)).toEqual(payload);
  });

  it("keeps uncompressed JSON responses working", () => {
    const payload = { brand: { HYU: { modelList: "1,2" } } };

    expect(decodeWoorifcResponse(JSON.stringify(payload))).toEqual(payload);
  });

  it("rejects a deterministic high-expansion response at the decoded-size ceiling", () => {
    const payload = { fixture: "woorifc-bounded-expansion", payload: "A".repeat(WOORIFC_MAX_DECODED_RESPONSE_BYTES) };
    const raw = encodeResponse(payload);

    // This is the safe regression fixture for the former unbounded inflate path:
    // its decoded JSON is larger than the production ceiling, so the decoder
    // must reject it before JSON.parse can consume the result.
    expect(Buffer.byteLength(JSON.stringify(payload), "utf8")).toBeGreaterThan(WOORIFC_MAX_DECODED_RESPONSE_BYTES);
    expect(() => decodeWoorifcResponse(raw)).toThrow();
  });

  it("detects the usage-limit block page (meta refresh to ajucapital)", () => {
    // 실측 차단 응답: 200 + 70바이트, doctype 없이 meta 태그 단독
    const blockPage = `<meta http-equiv="refresh" content="0;url=https://m.ajucapital.co.kr">`;

    expect(() => decodeWoorifcResponse(blockPage)).toThrow(/사용량 제한/);
  });

  it("rejects corrupt compressed data", () => {
    const corrupt = Buffer.from("not-a-zlib-stream", "utf8").toString("base64");

    expect(() => decodeWoorifcResponse(corrupt)).toThrow();
  });
});
