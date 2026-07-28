import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecommendScrollBehavior } from "./use-recommend-auto-scroll";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getRecommendScrollBehavior", () => {
  it("uses immediate scrolling when reduced motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }))
    );

    expect(getRecommendScrollBehavior()).toBe("auto");
  });

  it("uses smooth scrolling by default", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false }))
    );

    expect(getRecommendScrollBehavior()).toBe("smooth");
  });
});
