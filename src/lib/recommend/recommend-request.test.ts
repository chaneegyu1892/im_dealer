import { describe, expect, it } from "vitest";
import { recommendRequestSchema } from "./recommend-request";

const valid = {
  industry: "개인",
  industryDetail: "2~3명",
  preferences: ["가족", "안정감"],
  primaryPreference: "안정감",
  situationPreference: "가족",
  childDetail: "미취학",
  annualMileage: 20_000,
  fuelPreference: "하이브리드",
  residenceRegion: "일반",
  returnType: "미정",
};

describe("recommend request", () => {
  it("accepts the unchanged UI payload and normalizes preference order", () => {
    const parsed = recommendRequestSchema.parse(valid);
    expect(parsed.preferences).toEqual(["안정감", "가족"]);
  });

  it.each([
    ["industry detail", { ...valid, industryDetail: "1대" }, "industryDetail"],
    ["mileage", { ...valid, annualMileage: 15_000 }, "annualMileage"],
    ["fuel", { ...valid, fuelPreference: "수소" }, "fuelPreference"],
    ["duplicate preference", { ...valid, preferences: ["가족", "가족"] }, "preferences"],
    ["mismatched preference", { ...valid, preferences: ["가족"] }, "preferences"],
    ["missing child", { ...valid, childDetail: undefined }, "childDetail"],
    ["stray child", { ...valid, situationPreference: undefined, childDetail: "영유아", preferences: ["안정감"] }, "childDetail"],
    ["missing cargo", { ...valid, situationPreference: "화물", childDetail: undefined, preferences: ["안정감", "화물"] }, "cargoDetail"],
    ["non-EV charging", { ...valid, chargingEnvironment: "자택" }, "chargingEnvironment"],
    ["missing EV charging", { ...valid, fuelPreference: "전기차" }, "chargingEnvironment"],
  ])("rejects %s at %s", (_label, value, expectedPath) => {
    const parsed = recommendRequestSchema.safeParse(value);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.map((issue) => issue.path[0])).toContain(expectedPath);
  });

  it("accepts matching EV and cargo conditional inputs", () => {
    expect(recommendRequestSchema.safeParse({
      ...valid,
      preferences: ["화물"],
      primaryPreference: undefined,
      situationPreference: "화물",
      childDetail: undefined,
      cargoDetail: "대형 화물",
      fuelPreference: "전기차",
      chargingEnvironment: "외부",
    }).success).toBe(true);
  });
});
