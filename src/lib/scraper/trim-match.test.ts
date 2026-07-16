import { describe, it, expect } from "vitest";
import { tokens, matchTrim, findModelIndex, type CatalogCandidate } from "./trim-match";

// 실제 ORIX 카탈로그 형태의 후보 (label = MDEL_NAME2, year = MDEL_YEAR)
const c = (label: string, year = ""): CatalogCandidate => ({ label, year });

describe("tokens", () => {
  it("배기량·구동·연료·등급을 추출한다", () => {
    const t = tokens("2026년형 가솔린 2.5 터보 (개소세 5% 기준) 캘리그래피 AWD");
    expect(t.disp).toBe("2.5");
    expect(t.drive).toBe("4wd");
    expect(t.engine).toBe("gas");
    expect(t.grade).toBe("캘리그래피");
  });

  it("긴 등급명을 짧은 등급명보다 우선한다 (캘리그래피 블랙 잉크)", () => {
    expect(tokens("캘리그래피 블랙 잉크 2WD").grade).toBe("캘리그래피 블랙 잉크");
  });

  it("하이브리드/디젤/LPG/전기를 구분한다", () => {
    expect(tokens("디젤 2.2 5인승").engine).toBe("diesel");
    expect(tokens("하이브리드 1.6").engine).toBe("hev");
    expect(tokens("LPG 3.5").engine).toBe("lpg");
  });
});

describe("matchTrim", () => {
  const catalog = [
    c("가솔린 2.5 터보 2WD 기본형 [2026]", "2026"),
    c("가솔린 2.5 터보 AWD 기본형 [2026]", "2026"),
    c("가솔린 3.5 터보 2WD 기본형 [2026]", "2026"),
    c("디젤 2.2 2WD 5인승 노블레스 [2026]", "2026"),
  ];

  it("배기량+구동 일치로 매칭한다 (index 반환)", () => {
    const m = matchTrim("2026년형 가솔린 2.5 터보 (개소세 5% 기준) AWD", catalog);
    expect(m).not.toBeNull();
    expect(m!.index).toBe(1);
  });

  it("배기량 불일치는 제외한다", () => {
    const m = matchTrim("2026년형 가솔린 3.5 터보 2WD", catalog);
    expect(m!.index).toBe(2);
  });

  it("연식이 양쪽에 있고 다르면 매칭하지 않는다", () => {
    const m = matchTrim("2025년형 가솔린 2.5 터보 AWD", catalog);
    expect(m).toBeNull();
  });

  it("연료 불일치(LPG↔가솔린)는 제외한다", () => {
    const m = matchTrim("LPG 2.5 AWD", catalog);
    expect(m).toBeNull();
  });

  it("N Line 은 일반 트림과 매칭하지 않는다", () => {
    const m = matchTrim("가솔린 2.5 터보 N라인 AWD", catalog);
    expect(m).toBeNull();
  });

  it("토큰 점수 4 미만이면 매칭하지 않는다", () => {
    // 구동계(1점)만 일치 — score < 4
    expect(matchTrim("2WD", catalog)).toBeNull();
  });

  it("등급까지 완전 일치하면 exact", () => {
    const m = matchTrim("2026년형 디젤 2.2 5인승 노블레스 2WD", catalog);
    expect(m!.index).toBe(3);
    expect(m!.confidence).toBe("exact");
  });
});

describe("matchTrim — 쉐보레 영문 등급 (LS/Redline/ACTIV/RS)", () => {
  // 실제 ORIX 트랙스 카탈로그 (2026-07 수집)
  const trax = [
    c("1.2 가솔린 터보 LS [2026]", "2026"),
    c("1.2 가솔린 터보 Redline [2026]", "2026"),
    c("1.2 가솔린 터보 ACTIV [2026]", "2026"),
    c("1.2 가솔린 터보 RS [2026]", "2026"),
  ];

  it("영문 등급으로 각자 올바른 후보에 매칭한다 (동점 오매칭 방지)", () => {
    expect(matchTrim("2026년형 가솔린 1.2 E-터보 LS", trax)!.index).toBe(0);
    expect(matchTrim("2026년형 가솔린 1.2 E-터보 Redline", trax)!.index).toBe(1);
    expect(matchTrim("2026년형 가솔린 1.2 E-터보 ACTIV", trax)!.index).toBe(2);
    expect(matchTrim("2026년형 가솔린 1.2 E-터보 RS", trax)!.index).toBe(3);
  });

  it("한글 표기 이형(레드라인)도 같은 등급으로 매칭한다", () => {
    expect(matchTrim("2026년형 가솔린 1.2 터보 레드라인", trax)!.index).toBe(1);
  });
});

describe("findModelIndex", () => {
  const models = ["G70", "G80", "G90", "GV60", "GV70", "GV80"];

  it("완전일치를 먼저 시도한다", () => {
    expect(findModelIndex("GV70", models)).toBe(4);
  });

  it("마케팅 이름(우리명 ⊇ 외부명)을 긴 외부명 우선으로 매칭한다", () => {
    expect(findModelIndex("디 올 뉴 G80 F/L", models)).toBe(1);
    expect(findModelIndex("GV80 Coupe", models)).toBe(5); // "G80"이 아니라 "GV80"
  });

  it("외부명 ⊇ 우리명도 매칭한다", () => {
    expect(findModelIndex("쏘렌토", ["쏘렌토 하이브리드", "카니발"])).toBe(0);
  });

  it("못 찾으면 -1", () => {
    expect(findModelIndex("모하비", models)).toBe(-1);
  });
});
