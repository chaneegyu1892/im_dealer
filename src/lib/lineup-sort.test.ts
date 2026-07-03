import { describe, it, expect } from "vitest";
import { getLineupTier, getLineupYear, latestYearLineupNames, sortLineups } from "./lineup-sort";

describe("getLineupTier", () => {
  it("가솔린 라인업은 최상단(0)", () => {
    expect(getLineupTier("가솔린 2.5")).toBe(0);
    expect(getLineupTier("가솔린 1.6 터보 하이브리드")).toBe(0);
    expect(getLineupTier("가솔린/LPG 바이퓨얼 1.5 (개소세 5% 기준, 사양변경)")).toBe(0);
  });

  it("일반판매용 LPG 계열은 표기 변형 모두 최상단(0)", () => {
    expect(getLineupTier("LPG 3.5 일반판매용 (개소세 5% 기준)")).toBe(0);
    expect(getLineupTier("LPi 2.0 일반 판매용 (개소세 5% 기준)")).toBe(0);
    expect(getLineupTier("LPi 1.6 일반 판매 (개소세 5% 기준)")).toBe(0);
    expect(getLineupTier("LPG 3.5 일반용 (개소세 5% 기준)")).toBe(0);
  });

  it("특수 목적 라인업은 최하단(2)", () => {
    expect(getLineupTier("LPG 3.5 택시")).toBe(2);
    expect(getLineupTier("LPi 2.0 장애인용")).toBe(2);
    expect(getLineupTier("LPG 3.5 장애인 전용")).toBe(2);
    expect(getLineupTier("영업용")).toBe(2);
    expect(getLineupTier("LPi 1.6 렌터카")).toBe(2);
    expect(getLineupTier("특장차 구급차 디젤 2.2")).toBe(2);
    expect(getLineupTier("특장차 휠체어리프트 LPG 3.5")).toBe(2);
    expect(getLineupTier("어린이 통학차 킨더 가솔린 1.6 터보")).toBe(2);
    expect(getLineupTier("패신저 5인승 도너 (자동차제작자등 등록사업자)")).toBe(2);
    expect(getLineupTier("LPG 2.5 1톤 초장축 2WD 운전교습용")).toBe(2);
  });

  it("특수 키워드가 가솔린/일반LPG 키워드보다 우선한다", () => {
    expect(getLineupTier("영업용 라운지 가솔린 1.6 터보 7인승")).toBe(2);
    expect(getLineupTier("웨이브 택시 (개소세 5% 기준)")).toBe(2);
    expect(getLineupTier("패신저 5인승 택시 (개소세 5% 기준)")).toBe(2);
  });

  it("그 외(디젤/하이브리드/전기/일반 키워드 없는 LPG)는 중간(1)", () => {
    expect(getLineupTier("디젤 2.2")).toBe(1);
    expect(getLineupTier("하이브리드 5인승")).toBe(1);
    expect(getLineupTier("전기 (개소세 5% 기준, 소화기 비치)")).toBe(1);
    expect(getLineupTier("LPG 2.5 1톤 표준캡 2WD")).toBe(1);
    expect(getLineupTier("ALPHA 전기 밴")).toBe(1);
  });

  it("트럭 특장(탑차/윙바디/파워게이트/덤프)은 특수로 내리지 않는다", () => {
    expect(getLineupTier("냉동탑차 1톤 베이스")).toBe(1);
    expect(getLineupTier("윙바디 1톤 베이스")).toBe(1);
    expect(getLineupTier("파워게이트 1톤 베이스")).toBe(1);
    expect(getLineupTier("덤프 1톤 베이스")).toBe(1);
  });
});

describe("sortLineups", () => {
  it("일반 주력 → 기타 → 특수 순으로 정렬한다", () => {
    const input = [
      "2024년형 LPG 3.5 택시",
      "2024년형 LPi 2.0 장애인용",
      "2024년형 디젤 2.2",
      "2024년형 가솔린 2.5",
      "2024년형 LPG 3.5 일반판매용 (개소세 5% 기준)",
    ];
    expect(sortLineups(input)).toEqual([
      "2024년형 가솔린 2.5",
      "2024년형 LPG 3.5 일반판매용 (개소세 5% 기준)",
      "2024년형 디젤 2.2",
      "2024년형 LPG 3.5 택시",
      "2024년형 LPi 2.0 장애인용",
    ]);
  });

  it("같은 티어 안에서는 등장 순서 + 연식 내림차순을 유지한다", () => {
    const input = [
      "2023년형 가솔린 2.5",
      "2024년형 가솔린 2.5",
      "2024년형 가솔린 1.6 터보",
      "2023년형 디젤 2.2",
      "2024년형 디젤 2.2",
    ];
    expect(sortLineups(input)).toEqual([
      "2024년형 가솔린 2.5",
      "2023년형 가솔린 2.5",
      "2024년형 가솔린 1.6 터보",
      "2024년형 디젤 2.2",
      "2023년형 디젤 2.2",
    ]);
  });

  it("입력 배열을 변경하지 않는다", () => {
    const input = ["2024년형 LPG 3.5 택시", "2024년형 가솔린 2.5"];
    const copy = [...input];
    sortLineups(input);
    expect(input).toEqual(copy);
  });

  it("특수 라인업만 있는 차량(택시 전용 등)도 그대로 정렬된다", () => {
    const input = ["2024년형 LPG 3.5 택시", "2023년형 LPG 3.5 택시"];
    expect(sortLineups(input)).toEqual([
      "2024년형 LPG 3.5 택시",
      "2023년형 LPG 3.5 택시",
    ]);
  });
});

describe("getLineupYear", () => {
  it("4자리 연식과 2자리 연식을 모두 4자리 연도로 반환한다", () => {
    expect(getLineupYear("2026년형 가솔린 2.5")).toBe(2026);
    expect(getLineupYear("26년형 가솔린 2.5")).toBe(2026);
  });
});

describe("latestYearLineupNames", () => {
  it("같은 차량군에서 2자리 연식 표기까지 비교해 최신 연식만 남긴다", () => {
    const latest = latestYearLineupNames([
      "25년형 가솔린 2.5",
      "26년형 가솔린 2.5",
      "2025년형 하이브리드",
      "2026년형 하이브리드",
    ]);

    expect(latest).toEqual(new Set(["26년형 가솔린 2.5", "2026년형 하이브리드"]));
  });
});
