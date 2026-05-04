import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  encryptPII,
  decryptPII,
  encryptString,
  decryptString,
  decryptVerificationRow,
  isEncryptedBlob,
  _resetKeyCacheForTesting,
} from "./pii";

const TEST_KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  _resetKeyCacheForTesting();
});

afterEach(() => {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  _resetKeyCacheForTesting();
});

describe("encryptPII / decryptPII", () => {
  it("round-trips an object", () => {
    const input = { name: "홍길동", license: "12-34-567890-12", scores: [1, 2, 3] };
    const enc = encryptPII(input);
    expect(isEncryptedBlob(enc)).toBe(true);
    const dec = decryptPII(enc);
    expect(dec).toEqual(input);
  });

  it("round-trips primitives", () => {
    expect(decryptPII(encryptPII("plain string"))).toBe("plain string");
    expect(decryptPII(encryptPII(12345))).toBe(12345);
    expect(decryptPII(encryptPII(true))).toBe(true);
    expect(decryptPII(encryptPII(null))).toBe(null);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const a = encryptPII({ x: 1 });
    const b = encryptPII({ x: 1 });
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
  });

  it("throws when auth tag is tampered", () => {
    const enc = encryptPII({ secret: "topsecret" });
    const tampered = { ...enc, tag: Buffer.alloc(16, 0).toString("base64") };
    expect(() => decryptPII(tampered)).toThrow();
  });

  it("throws when ciphertext is tampered", () => {
    const enc = encryptPII({ secret: "topsecret" });
    const ctBuf = Buffer.from(enc.ct, "base64");
    ctBuf[0] = ctBuf[0] ^ 0xff;
    const tampered = { ...enc, ct: ctBuf.toString("base64") };
    expect(() => decryptPII(tampered)).toThrow();
  });

  it("throws when decrypting with a different key", () => {
    const enc = encryptPII({ secret: "topsecret" });
    process.env.PII_ENCRYPTION_KEY = OTHER_KEY;
    _resetKeyCacheForTesting();
    expect(() => decryptPII(enc)).toThrow();
  });

  it("returns legacy plaintext as-is (migration compat)", () => {
    const legacy = { license: "raw", issued: "2020-01-01" };
    expect(decryptPII(legacy)).toEqual(legacy);
  });

  it("handles null/undefined gracefully", () => {
    expect(decryptPII(null)).toBeNull();
    expect(decryptPII(undefined)).toBeNull();
  });

  it("throws if PII_ENCRYPTION_KEY is missing on first encrypt", () => {
    delete process.env.PII_ENCRYPTION_KEY;
    _resetKeyCacheForTesting();
    expect(() => encryptPII({ x: 1 })).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("throws if PII_ENCRYPTION_KEY is wrong length", () => {
    process.env.PII_ENCRYPTION_KEY = Buffer.alloc(16, 0).toString("base64");
    _resetKeyCacheForTesting();
    expect(() => encryptPII({ x: 1 })).toThrow(/32바이트/);
  });
});

describe("encryptString / decryptString", () => {
  it("round-trips string via JSON wrapper", () => {
    const enc = encryptString("connected-id-token-12345");
    expect(typeof enc).toBe("string");
    expect(enc).toContain('"v":1');
    expect(decryptString(enc)).toBe("connected-id-token-12345");
  });

  it("returns null for null/empty input", () => {
    expect(encryptString(null)).toBeNull();
    expect(decryptString(null)).toBeNull();
    expect(decryptString("")).toBeNull();
  });

  it("returns legacy plaintext as-is when not JSON or not encrypted blob", () => {
    expect(decryptString("legacy-plain-token")).toBe("legacy-plain-token");
    // 우연히 JSON 으로 파싱되지만 EncryptedBlob 형식이 아닌 경우
    expect(decryptString('{"foo":"bar"}')).toBe('{"foo":"bar"}');
  });
});

describe("decryptVerificationRow", () => {
  it("decrypts all four PII fields", () => {
    const row = {
      id: "v1",
      sessionId: "s1",
      customerType: "individual",
      connectedId: encryptString("token-abc"),
      licenseData: encryptPII({ no: "12-34-567890-12", name: "홍길동" }),
      insuranceData: encryptPII({ status: "joined" }),
      bizData: null,
    };

    const out = decryptVerificationRow(row);
    expect(out.connectedId).toBe("token-abc");
    expect(out.licenseData).toEqual({ no: "12-34-567890-12", name: "홍길동" });
    expect(out.insuranceData).toEqual({ status: "joined" });
    expect(out.bizData).toBeNull();
    // 그 외 필드는 보존
    expect(out.id).toBe("v1");
    expect(out.sessionId).toBe("s1");
  });

  it("preserves legacy plaintext rows (migration compat)", () => {
    const row = {
      id: "v2",
      connectedId: "raw-token",
      licenseData: { no: "raw" },
      insuranceData: null,
      bizData: { biz: "raw" },
    };
    const out = decryptVerificationRow(row);
    expect(out.connectedId).toBe("raw-token");
    expect(out.licenseData).toEqual({ no: "raw" });
    expect(out.bizData).toEqual({ biz: "raw" });
  });
});
