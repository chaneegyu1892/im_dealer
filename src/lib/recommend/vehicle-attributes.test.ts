import { describe, expect, it } from "vitest";
import {
  buildVehicleAttrs,
  detectAwd,
  detectRefrigerated,
  extractCargoKg,
  extractSeating,
  getRecommendFuelGroup,
  matchesRecommendFuelPreference,
  normalizeFuel,
  resolveAdvancedSafety,
  resolveSlidingDoor,
  type AttrTrimInput,
  type AttrVehicleInput,
} from "./vehicle-attributes";

describe("recommend fuel matching", () => {
  it.each([
    ["GASOLINE", "가솔린", "ICE"],
    ["DIESEL", "디젤", "ICE"],
    ["HEV", "하이브리드", "HEV"],
    ["PHEV", "하이브리드", "HEV"],
    ["ELECTRIC", "EV", "EV"],
    ["전기", "EV", "EV"],
  ] as const)("normalizes %s to %s / %s", (engineType, fuel, group) => {
    expect(normalizeFuel(engineType)).toBe(fuel);
    expect(getRecommendFuelGroup(engineType)).toBe(group);
  });

  it("treats a selected fuel as a hard filter", () => {
    expect(matchesRecommendFuelPreference("가솔린/디젤", "GASOLINE")).toBe(true);
    expect(matchesRecommendFuelPreference("가솔린/디젤", "EV")).toBe(false);
    expect(matchesRecommendFuelPreference("하이브리드", "HEV")).toBe(true);
    expect(matchesRecommendFuelPreference("하이브리드", "DIESEL")).toBe(false);
    expect(matchesRecommendFuelPreference("전기차", "ELECTRIC")).toBe(true);
    expect(matchesRecommendFuelPreference("전기차", "PHEV")).toBe(false);
    expect(matchesRecommendFuelPreference("상관없음", "EV")).toBe(true);
  });
});

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
  it("냉동탑차 포함 → true (냉동 키워드)", () => {
    expect(detectRefrigerated("전기 특장차 냉동탑차 로우 킹캡")).toBe(true);
  });

  it("냉동 포함 → true", () => {
    expect(detectRefrigerated("냉동탑차 7.5톤 슈퍼캡")).toBe(true);
  });

  it("내장탑차(평범한 탑차) → false (냉장·냉동·보냉 없음)", () => {
    expect(detectRefrigerated("하이 내장탑차")).toBe(false);
  });

  it("윙바디 → false (냉장·냉동·보냉 없음)", () => {
    expect(detectRefrigerated("17톤 윙바디 초장축")).toBe(false);
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

  it("null → null", () => {
    expect(extractSeating(null)).toBeNull();
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

  it("override=true이면 화이트리스트·옵션 없어도 true", () => {
    expect(
      resolveSlidingDoor({ name: "G80", override: true, optionNames: [] }),
    ).toBe(true);
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

// ─────────────────────────────────────────────
// 1.4 연료 정규화 + 통합 빌더
// ─────────────────────────────────────────────
describe("buildVehicleAttrs", () => {
  const vehicle: AttrVehicleInput = {
    name: "기아 카니발",
    isPopular: true,
    slidingDoorOverride: null,
    advancedSafetyOverride: null,
  };

  const trim: AttrTrimInput = {
    name: "9인승 디젤 4WD",
    engineType: "디젤",
    detailedSpecs: {
      externalRaw: {
        person: "9",
        carry: "0",
        documents: [{ content: "전방 충돌방지 보조" }],
      },
    },
    options: [{ name: "2열 파워 슬라이딩 도어" }],
  };

  it("카니발 9인승 4WD 디젤 통합 결과", () => {
    const attrs = buildVehicleAttrs(vehicle, trim);
    expect(attrs.isAwd).toBe(true);
    expect(attrs.seating).toBe(9);
    expect(attrs.fuel).toBe("디젤");
    expect(attrs.hasSlidingDoor).toBe(true);
    expect(attrs.hasAdvancedSafety).toBe(true);
    expect(attrs.isRefrigerated).toBe(false);
    expect(attrs.cargoKg).toBeNull();
    expect(attrs.isPopular).toBe(true);
  });

  it("알 수 없는 engineType → '기타'", () => {
    const attrs = buildVehicleAttrs(vehicle, { ...trim, engineType: "CNG" });
    expect(attrs.fuel).toBe("기타");
  });

  it("EV engineType → 'EV'", () => {
    const attrs = buildVehicleAttrs(vehicle, { ...trim, engineType: "EV" });
    expect(attrs.fuel).toBe("EV");
  });
});
