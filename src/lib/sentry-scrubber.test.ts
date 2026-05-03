import { describe, expect, it } from "vitest";
import { scrubPII } from "./sentry-scrubber";

describe("scrubPII", () => {
  it("masks Korean phone numbers in any format", () => {
    const input = {
      a: "010-1234-5678",
      b: "01012345678",
      c: "010 1234 5678",
      d: "+82 10 1234 5678",
    };
    const out = scrubPII(input) as Record<string, string>;
    expect(out.a).toBe("[PHONE]");
    expect(out.b).toBe("[PHONE]");
    expect(out.c).toBe("[PHONE]");
    expect(out.d).toBe("[PHONE]");
  });

  it("masks business registration numbers", () => {
    const out = scrubPII("문의: 105-87-66533 입니다") as string;
    expect(out).toContain("[BIZ_NO]");
    expect(out).not.toContain("105-87-66533");
  });

  it("masks license numbers", () => {
    const out = scrubPII("면허 12-34-567890-12") as string;
    expect(out).toContain("[LICENSE]");
  });

  it("masks resident registration numbers", () => {
    const out = scrubPII("주민 900101-1234567") as string;
    expect(out).toContain("[RRN]");
    expect(out).not.toContain("900101");
  });

  it("masks emails", () => {
    const out = scrubPII({ email: "user@example.com" }) as Record<string, string>;
    expect(out.email).toBe("[EMAIL]");
  });

  it("masks sensitive keys regardless of value", () => {
    const out = scrubPII({
      licenseData: { foo: "bar", nested: { x: 1 } },
      connectedId: "abc-token-123",
      passwordHash: "$2a$10$xxxxx",
      normal: "keep me",
    }) as Record<string, unknown>;
    expect(out.licenseData).toBe("***");
    expect(out.connectedId).toBe("***");
    expect(out.passwordHash).toBe("***");
    expect(out.normal).toBe("keep me");
  });

  it("recurses into nested objects and arrays", () => {
    const out = scrubPII({
      level1: {
        level2: [
          { phone: "010-1111-2222" },
          { phone: "010-3333-4444" },
        ],
      },
    }) as { level1: { level2: Array<{ phone: string }> } };
    expect(out.level1.level2[0].phone).toBe("[PHONE]");
    expect(out.level1.level2[1].phone).toBe("[PHONE]");
  });

  it("leaves clean payload unchanged", () => {
    const input = { name: "차량명", price: 43840000, isActive: true };
    expect(scrubPII(input)).toEqual(input);
  });

  it("handles null and undefined", () => {
    expect(scrubPII(null)).toBeNull();
    expect(scrubPII(undefined)).toBeUndefined();
  });

  it("truncates extremely long strings", () => {
    const longStr = "a".repeat(5000);
    const out = scrubPII(longStr) as string;
    expect(out.length).toBeLessThan(longStr.length);
    expect(out.endsWith("[truncated]")).toBe(true);
  });

  it("guards against deep recursion", () => {
    type Nested = { next: Nested | string };
    let leaf: Nested = { next: "deep" };
    for (let i = 0; i < 20; i++) leaf = { next: leaf };
    // 깊이 초과는 문자열로 대체되어야 한다
    const out = JSON.stringify(scrubPII(leaf));
    expect(out).toContain("truncated:depth");
  });
});
