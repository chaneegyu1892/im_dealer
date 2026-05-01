import { describe, it, expect } from "vitest";
import { timingSafeEqualString } from "./security";

describe("timingSafeEqualString", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("", "")).toBe(true);
  });

  it("returns false for differing strings of equal length", () => {
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("token-1", "token-2")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
    expect(timingSafeEqualString("a", "")).toBe(false);
  });

  it("handles unicode correctly via charCodeAt", () => {
    expect(timingSafeEqualString("토큰", "토큰")).toBe(true);
    expect(timingSafeEqualString("토큰A", "토큰B")).toBe(false);
  });
});
