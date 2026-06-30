import { describe, it, expect } from "vitest";
import { deriveHashtags } from "./vehicle-hashtags";

const base = {
  category: "세단" as const,
  isPopular: false,
  vehicleName: "테스트카",
  basePrice: 40_000_000,
  defaultTrim: { name: "기본", engineType: "가솔린" as const, fuelEfficiency: 12 },
};

describe("deriveHashtags", () => {
  it("인기 차량은 #인기를 포함한다", () => {
    expect(deriveHashtags({ ...base, isPopular: true })).toContain("#인기");
  });

  it("고가 차량은 #프리미엄, 저가 차량은 #실속", () => {
    expect(deriveHashtags({ ...base, basePrice: 70_000_000 })).toContain("#프리미엄");
    expect(deriveHashtags({ ...base, basePrice: 25_000_000 })).toContain("#실속");
  });

  it("engineType=EV 또는 차량명 전기 → #전기차", () => {
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "롱레인지", engineType: "EV", fuelEfficiency: 5 } })
    ).toContain("#전기차");
    expect(deriveHashtags({ ...base, vehicleName: "아반떼 전기" })).toContain("#전기차");
  });

  it("HEV는 engineType=가솔린이라도 차량명으로 #하이브리드 검출", () => {
    const tags = deriveHashtags({
      ...base,
      vehicleName: "디 올 뉴 그랜저 HEV",
      defaultTrim: { name: "프리미엄", engineType: "가솔린", fuelEfficiency: 16.9 },
    });
    expect(tags).toContain("#하이브리드");
  });

  it("연료별 임계값 이상이면 #고연비 (EV는 제외)", () => {
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "기본", engineType: "가솔린", fuelEfficiency: 18 } })
    ).toContain("#고연비");
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "기본", engineType: "가솔린", fuelEfficiency: 10 } })
    ).not.toContain("#고연비");
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "롱레인지", engineType: "EV", fuelEfficiency: 5.5 } })
    ).not.toContain("#고연비");
  });

  it("트림명 AWD → #사륜구동", () => {
    expect(
      deriveHashtags({ ...base, defaultTrim: { name: "프레스티지 AWD", engineType: "가솔린", fuelEfficiency: 11 } })
    ).toContain("#사륜구동");
  });

  it("특징이 없으면 차종 폴백으로 최소 1개 보장", () => {
    const tags = deriveHashtags({ ...base, defaultTrim: { name: "기본", engineType: "가솔린", fuelEfficiency: 10 } });
    expect(tags).toContain("#세단");
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });

  it("최대 3개로 제한된다", () => {
    const tags = deriveHashtags({
      ...base,
      isPopular: true,
      basePrice: 70_000_000,
      defaultTrim: { name: "AWD", engineType: "가솔린", fuelEfficiency: 18 },
    });
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it("어드민 수동 태그가 앞에 오고 # 정규화된다", () => {
    const tags = deriveHashtags({ ...base, isPopular: true, manualTags: ["대박할인", "#신차"] });
    expect(tags[0]).toBe("#대박할인");
    expect(tags).toContain("#신차");
  });

  it("수동+자동 합쳐도 중복 제거되고 3개 이하", () => {
    const tags = deriveHashtags({
      ...base,
      isPopular: true,
      manualTags: ["#인기", "#A", "#B", "#C"],
    });
    expect(tags).toEqual(["#인기", "#A", "#B"]);
  });
});
