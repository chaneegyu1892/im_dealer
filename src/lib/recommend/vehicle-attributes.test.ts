import { describe, expect, it } from "vitest";
import { detectAwd } from "./vehicle-attributes";

// ─────────────────────────────────────────────
// 1.1 AWD 판별
// ─────────────────────────────────────────────
describe("detectAwd", () => {
  it("AWD 포함 트림명 → true", () => {
    expect(detectAwd("프레스티지 AWD (19인치)")).toBe(true);
  });

  it("4WD 포함 트림명 → true", () => {
    expect(detectAwd("7인승 인스퍼레이션 4WD A/T")).toBe(true);
  });

  it("4MATIC 포함 트림명 → true", () => {
    expect(detectAwd("E-Class 4MATIC")).toBe(true);
  });

  it("콰트로 포함 트림명 → true", () => {
    expect(detectAwd("콰트로 45 TFSI")).toBe(true);
  });

  it("일반 트림명 → false", () => {
    expect(detectAwd("2024년형 가솔린 2.5 익스클루시브")).toBe(false);
  });
});
