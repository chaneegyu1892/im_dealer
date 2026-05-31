import { describe, expect, it } from "vitest";
import { extractDrivetrain, lineupDisplayLabel } from "./drivetrain";

describe("extractDrivetrain", () => {
  it("일반 차량 트림 이름에서 구동방식을 추출한다", () => {
    expect(extractDrivetrain("프레스티지 2WD")).toBe("2WD");
    expect(extractDrivetrain("노블레스 4WD")).toBe("4WD");
  });

  it("HEV 라인업 이름에서 구동방식을 추출한다", () => {
    expect(extractDrivetrain("2025년형 가솔린 1.6T HEV 4WD 5인승 (개소세 5% 기준)")).toBe("4WD");
  });

  it("AWD 및 소문자도 대문자로 정규화한다", () => {
    expect(extractDrivetrain("Exclusive awd")).toBe("AWD");
    expect(extractDrivetrain("스포츠 2wd")).toBe("2WD");
  });

  it("구동방식 토큰이 없으면 null", () => {
    expect(extractDrivetrain("프레스티지")).toBeNull();
    expect(extractDrivetrain("2025년형 가솔린 2.5 터보 5인승")).toBeNull();
  });

  it("빈 값/누락을 안전하게 처리한다", () => {
    expect(extractDrivetrain("")).toBeNull();
    expect(extractDrivetrain(null)).toBeNull();
    expect(extractDrivetrain(undefined)).toBeNull();
  });
});

describe("lineupDisplayLabel", () => {
  it("HEV — 라인업 이름에 이미 구동방식이 있으면 그대로 반환(중복 접미 안 함)", () => {
    const lineup = "2025년형 가솔린 1.6T HEV 4WD 5인승 (개소세 5% 기준)";
    expect(lineupDisplayLabel(lineup, "프레스티지")).toBe(lineup);
  });

  it("일반 차량 — 라인업엔 없고 트림에서 추출 시 ' · 2WD' 접미", () => {
    const lineup = "2025년형 가솔린 2.5 터보 5인승 (개소세 5% 기준)";
    expect(lineupDisplayLabel(lineup, "프레스티지 2WD")).toBe(`${lineup} · 2WD`);
    expect(lineupDisplayLabel(lineup, "노블레스 4WD")).toBe(`${lineup} · 4WD`);
  });

  it("둘 다 구동방식이 없으면 라인업 이름 그대로(FWD 전용 차량)", () => {
    const lineup = "2025년형 가솔린 1.6 5인승";
    expect(lineupDisplayLabel(lineup, "스마트")).toBe(lineup);
  });
});
