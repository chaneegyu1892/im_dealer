import { describe, it, expect } from "vitest";
import { groupTrimsByLineup } from "./trim-groups";

// 더 뉴 그랜저 패턴: 트림 name 이 등급명뿐, 라인업 관계가 상세
const GRANDEUR_TRIMS = [
  { id: "t1", name: "프리미엄", price: 42_500_000, specs: { lineup: "117110" }, lineup: { id: "l1", name: "2027년형 가솔린 2.5 2WD (개소세 5% 기준)" } },
  { id: "t2", name: "프리미엄", price: 43_980_000, specs: { lineup: "117113" }, lineup: { id: "l2", name: "2027년형 LPG 3.5 일반판매용 (개소세 5% 기준)" } },
  { id: "t3", name: "익스클루시브 플러스 왼발 장애", price: 45_350_000, specs: { lineup: "117114" }, lineup: { id: "l3", name: "2027년형 LPG 3.5 장애인용" } },
  { id: "t4", name: "익스클루시브", price: 47_000_000, specs: { lineup: "117110" }, lineup: { id: "l1", name: "2027년형 가솔린 2.5 2WD (개소세 5% 기준)" } },
];

// 카니발 패턴: 같은 라인업 안에 연식만 다른 동명 트림 (specs.trimName 보유)
const CARNIVAL_TRIMS = [
  { id: "c1", name: "2026년형 가솔린 3.5 9인승 노블레스", price: 40_710_000, specs: { trimName: "노블레스" }, lineup: { id: "l9", name: "일반 가솔린 9인승" } },
  { id: "c2", name: "2025년형 가솔린 3.5 9인승 노블레스", price: 40_210_000, specs: { trimName: "노블레스" }, lineup: { id: "l9", name: "일반 가솔린 9인승" } },
  { id: "c3", name: "2026년형 가솔린 3.5 9인승 시그니처", price: 44_260_000, specs: { trimName: "시그니처" }, lineup: { id: "l9", name: "일반 가솔린 9인승" } },
];

describe("groupTrimsByLineup", () => {
  it("라인업 관계명 기준으로 그룹화하고, 일반 주력 라인업이 먼저 온다", () => {
    const groups = groupTrimsByLineup(GRANDEUR_TRIMS);
    expect(groups.map((g) => g.lineup)).toEqual([
      "2027년형 가솔린 2.5 2WD (개소세 5% 기준)",
      "2027년형 LPG 3.5 일반판매용 (개소세 5% 기준)",
      "2027년형 LPG 3.5 장애인용", // 특수목적은 최하단
    ]);
    expect(groups[0].trims.map((t) => t.id)).toEqual(["t1", "t4"]);
  });

  it("그룹 헤더가 라인업을 보여주므로 동일 트림명이 그룹별로 분리된다", () => {
    const groups = groupTrimsByLineup(GRANDEUR_TRIMS);
    // 가솔린 그룹과 LPG 그룹에 각각 '프리미엄' 1개씩 — 그룹 내 중복 아님
    expect(groups[0].trims.filter((t) => t.displayName === "프리미엄")).toHaveLength(1);
    expect(groups[1].trims.filter((t) => t.displayName === "프리미엄")).toHaveLength(1);
    expect(groups[0].trims[0].extra).toBeNull();
  });

  it("같은 그룹 안의 동명 트림은 name 잔여 텍스트를 보조 라벨로 단다", () => {
    const groups = groupTrimsByLineup(CARNIVAL_TRIMS);
    expect(groups).toHaveLength(1);
    const [g] = groups;
    const nobles = g.trims.filter((t) => t.displayName === "노블레스");
    expect(nobles).toHaveLength(2);
    expect(nobles[0].extra).toBe("2026년형 가솔린 3.5 9인승");
    expect(nobles[1].extra).toBe("2025년형 가솔린 3.5 9인승");
    // 단일 트림은 보조 라벨 없음
    expect(g.trims.find((t) => t.displayName === "시그니처")?.extra).toBeNull();
  });

  it("라인업 정보가 전혀 없으면 헤더 없는 단일 그룹(lineup=null)으로 반환한다", () => {
    const flat = [
      { id: "f1", name: "스탠다드", price: 20_000_000, specs: null, lineup: null },
      { id: "f2", name: "롱레인지", price: 25_000_000, specs: null, lineup: null },
    ];
    const groups = groupTrimsByLineup(flat);
    expect(groups).toHaveLength(1);
    expect(groups[0].lineup).toBeNull();
    expect(groups[0].trims.map((t) => t.displayName)).toEqual(["스탠다드", "롱레인지"]);
  });

  it("입력 배열을 변경하지 않는다", () => {
    const copy = JSON.parse(JSON.stringify(GRANDEUR_TRIMS));
    groupTrimsByLineup(GRANDEUR_TRIMS);
    expect(GRANDEUR_TRIMS).toEqual(copy);
  });
});
