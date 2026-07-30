import { describe, expect, it } from "vitest";
import { shouldApplyJobCooldown } from "./job-outcome";

describe("shouldApplyJobCooldown", () => {
  it("정상 완료에만 작업 간 쿨다운을 적용한다", () => {
    expect(shouldApplyJobCooldown("completed")).toBe(true);
    expect(shouldApplyJobCooldown("canceled")).toBe(false);
    expect(shouldApplyJobCooldown("failed")).toBe(false);
  });
});
