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
  it("accepts and normalizes the STEP 02 v3 contract", () => {
    const parsed = recommendRequestSchema.parse({
      recommendationVersion: "step02-v3",
      industry: "개인",
      budgetRange: "lte-1000k",
      preferences: ["가족", "family-leisure"],
      stylePreference: "family-leisure",
      situationPreference: "가족",
      childDetail: "미취학",
      annualMileage: 20_000,
      fuelPreference: "하이브리드",
      residenceRegion: "일반",
      returnType: "미정",
    });
    expect(parsed.preferences).toEqual(["family-leisure", "가족"]);
    expect("recommendationVersion" in parsed && parsed.recommendationVersion).toBe("step02-v3");
    expect(parsed).toMatchObject({ budgetRange: "lte-1000k", budgetMin: 0, budgetMax: 1_000_000 });
  });

  it("rejects a v3 payload whose style and preferences disagree", () => {
    expect(recommendRequestSchema.safeParse({
      recommendationVersion: "step02-v3",
      industry: "개인",
      budgetRange: "auto",
      preferences: ["city-compact"],
      stylePreference: "family-leisure",
      annualMileage: 20_000,
      fuelPreference: "상관없음",
      residenceRegion: "일반",
      returnType: "미정",
    }).success).toBe(false);
  });

  it("reports an unsupported recommendation version at the version field", () => {
    const parsed = recommendRequestSchema.safeParse({
      recommendationVersion: "step02-v4",
      industry: "개인",
      budgetRange: "auto",
      preferences: ["family-leisure"],
      stylePreference: "family-leisure",
      annualMileage: 20_000,
      fuelPreference: "상관없음",
      residenceRegion: "일반",
      returnType: "미정",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path[0])).toContain("recommendationVersion");
    }
  });

  it.each(["budgetMin", "budgetMax"])("rejects client-supplied %s for v3", (field) => {
    const parsed = recommendRequestSchema.safeParse({
      recommendationVersion: "step02-v3",
      industry: "개인",
      budgetRange: "gte-1000k",
      preferences: ["premium-formal"],
      stylePreference: "premium-formal",
      annualMileage: 20_000,
      fuelPreference: "상관없음",
      residenceRegion: "일반",
      returnType: "미정",
      [field]: field === "budgetMin" ? 1_000_000 : 0,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes(field))).toBe(true);
    }
  });

  it.each([
    ["lte-500k", 0, 500_000],
    ["lte-800k", 0, 800_000],
    ["lte-1000k", 0, 1_000_000],
    ["gte-1000k", 1_000_000, 0],
    ["auto", 0, 0],
  ] as const)("derives trusted bounds for %s", (budgetRange, budgetMin, budgetMax) => {
    const parsed = recommendRequestSchema.parse({
      recommendationVersion: "step02-v3",
      industry: "개인",
      budgetRange,
      preferences: ["city-compact"],
      stylePreference: "city-compact",
      annualMileage: 20_000,
      fuelPreference: "상관없음",
      residenceRegion: "일반",
      returnType: "미정",
    });
    expect(parsed).toMatchObject({ budgetRange, budgetMin, budgetMax });
  });

  it("accepts the unified customer type and monthly budget payload", () => {
    const parsed = recommendRequestSchema.parse({
      ...valid,
      industryDetail: undefined,
      budgetMax: 1_000_000,
    });

    expect(parsed.budgetMax).toBe(1_000_000);
    expect(parsed.industryDetail).toBeUndefined();
  });

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
    ["unsupported budget", { ...valid, budgetMax: 750_000 }, "budgetMax"],
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
