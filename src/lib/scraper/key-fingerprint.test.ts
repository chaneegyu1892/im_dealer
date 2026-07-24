import { describe, it, expect } from "vitest";
import { keyFingerprint } from "./key-fingerprint";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("keyFingerprint", () => {
  it("같은 키는 같은 지문을 낸다", () => {
    expect(keyFingerprint(KEY)).toBe(keyFingerprint(KEY));
  });

  it("다른 키는 다른 지문을 낸다", () => {
    const other = Buffer.alloc(32, 9).toString("base64");
    expect(keyFingerprint(KEY)).not.toBe(keyFingerprint(other));
  });

  it("앞뒤 공백·줄바꿈이 섞여도 같은 지문이다", () => {
    expect(keyFingerprint(`  ${KEY}\n`)).toBe(keyFingerprint(KEY));
  });

  it("키 자체가 노출되지 않는다", () => {
    const fp = keyFingerprint(KEY)!;
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(KEY).not.toContain(fp);
  });

  it("미설정·빈 값은 null 이다", () => {
    expect(keyFingerprint(undefined)).toBeNull();
    expect(keyFingerprint(null)).toBeNull();
    expect(keyFingerprint("")).toBeNull();
    expect(keyFingerprint("   ")).toBeNull();
  });
});
