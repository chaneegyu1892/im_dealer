import { describe, expect, it } from "vitest";
import {
  detectAwd,
  detectRefrigerated,
  extractCargoKg,
  extractSeating,
  resolveAdvancedSafety,
  resolveSlidingDoor,
} from "./vehicle-attributes";

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

// ─────────────────────────────────────────────
// 1.2 적재중량·냉장냉동·승차인원 추출
// ─────────────────────────────────────────────
describe("extractCargoKg", () => {
  it("carry '1000' → 1000", () => {
    expect(extractCargoKg({ externalRaw: { carry: "1000" } })).toBe(1000);
  });

  it("carry '0' → null", () => {
    expect(extractCargoKg({ externalRaw: { carry: "0" } })).toBeNull();
  });

  it("externalRaw 없음 → null", () => {
    expect(extractCargoKg({})).toBeNull();
  });

  it("null → null", () => {
    expect(extractCargoKg(null)).toBeNull();
  });
});

describe("detectRefrigerated", () => {
  it("냉동탑차 포함 → true", () => {
    expect(detectRefrigerated("전기 특장차 냉동탑차 1.4t")).toBe(true);
  });

  it("내장탑차(탑차) 포함 → true", () => {
    expect(detectRefrigerated("하이 내장탑차")).toBe(true);
  });

  it("윙바디 포함 → true", () => {
    expect(detectRefrigerated("17톤 윙바디 차량")).toBe(true);
  });

  it("일반 트림명 → false", () => {
    expect(detectRefrigerated("슈퍼캡 초장축 프리미엄")).toBe(false);
  });
});

describe("extractSeating", () => {
  it("person '7' → 7", () => {
    expect(extractSeating({ externalRaw: { person: "7" } })).toBe(7);
  });

  it("person '' → null", () => {
    expect(extractSeating({ externalRaw: { person: "" } })).toBeNull();
  });

  it("externalRaw 없음 → null", () => {
    expect(extractSeating({})).toBeNull();
  });
});

// ─────────────────────────────────────────────
// 1.3 슬라이딩 도어·안전사양 판별
// ─────────────────────────────────────────────
describe("resolveSlidingDoor", () => {
  it("override=false이면 화이트리스트·옵션 무관하게 false", () => {
    expect(
      resolveSlidingDoor({
        name: "기아 카니발",
        override: false,
        optionNames: ["파워 슬라이딩 도어"],
      }),
    ).toBe(false);
  });

  it("차량명에 카니발 포함, override=null → true", () => {
    expect(
      resolveSlidingDoor({ name: "기아 카니발", override: null, optionNames: [] }),
    ).toBe(true);
  });

  it("차량명에 스타리아 포함, override=null → true", () => {
    expect(
      resolveSlidingDoor({ name: "스타리아 라운지", override: null, optionNames: [] }),
    ).toBe(true);
  });

  it("옵션명에 파워 슬라이딩 도어 포함 → true", () => {
    expect(
      resolveSlidingDoor({
        name: "쏘렌토",
        override: null,
        optionNames: ["2열 파워 슬라이딩 도어"],
      }),
    ).toBe(true);
  });

  it("화이트리스트·옵션 없음 → false", () => {
    expect(
      resolveSlidingDoor({ name: "G80", override: null, optionNames: ["선루프"] }),
    ).toBe(false);
  });
});

describe("resolveAdvancedSafety", () => {
  it("override=true → true", () => {
    expect(
      resolveAdvancedSafety({ override: true, optionNames: [], specText: "" }),
    ).toBe(true);
  });

  it("specText에 전방 충돌방지 보조·차로 이탈방지 보조 → true", () => {
    expect(
      resolveAdvancedSafety({
        override: null,
        optionNames: [],
        specText: "전방 충돌방지 보조, 차로 이탈방지 보조",
      }),
    ).toBe(true);
  });

  it("optionNames에 후측방 충돌방지 보조 포함 → true", () => {
    expect(
      resolveAdvancedSafety({
        override: null,
        optionNames: ["후측방 충돌방지 보조"],
        specText: "",
      }),
    ).toBe(true);
  });

  it("override=false → false (specText·옵션 무관)", () => {
    expect(
      resolveAdvancedSafety({
        override: false,
        optionNames: ["전방 충돌방지 보조"],
        specText: "차로 이탈방지 보조",
      }),
    ).toBe(false);
  });

  it("override=null, 매칭 없음 → false", () => {
    expect(
      resolveAdvancedSafety({ override: null, optionNames: [], specText: "선루프" }),
    ).toBe(false);
  });
});
