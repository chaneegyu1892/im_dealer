import { describe, expect, it } from "vitest";
import { formatReviewVehicleLabel } from "./review-utils";

describe("formatReviewVehicleLabel", () => {
  it("strips marketing prefixes for compact tags", () => {
    expect(formatReviewVehicleLabel("현대", "더 뉴 그랜저 HEV")).toBe("현대 그랜저 HEV");
    expect(formatReviewVehicleLabel("기아", "더 뉴 쏘렌토")).toBe("기아 쏘렌토");
    expect(formatReviewVehicleLabel("벤츠", "The New E-Class")).toBe("벤츠 E-Class");
    expect(formatReviewVehicleLabel("제네시스", "신형 G90")).toBe("제네시스 G90");
  });

  it("returns null when empty", () => {
    expect(formatReviewVehicleLabel(null, null)).toBeNull();
  });
});
