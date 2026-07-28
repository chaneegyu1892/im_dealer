import { describe, expect, it } from "vitest";
import { getSafeInternalPath } from "./redirect";

describe("getSafeInternalPath", () => {
  it("keeps an internal path with query and hash", () => {
    expect(
      getSafeInternalPath("/quote?vehicle=sonata&restore=1#result")
    ).toBe("/quote?vehicle=sonata&restore=1#result");
  });

  it.each([
    "https://evil.example/quote",
    "//evil.example/quote",
    "\\\\evil.example\\quote",
    "@evil.example",
    "javascript:alert(1)",
    "/quote\nLocation: https://evil.example",
  ])("rejects an external or malformed redirect: %s", (value) => {
    expect(getSafeInternalPath(value)).toBe("/");
  });

  it("uses the supplied fallback when no redirect was provided", () => {
    expect(getSafeInternalPath(null, "/cars")).toBe("/cars");
  });
});
