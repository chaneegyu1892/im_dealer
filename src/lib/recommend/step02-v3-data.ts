import type { Step02V3Style } from "@/constants/recommend-step02-v3";

export type Step02V3Level = "best" | "fit" | "support" | "none";
export type Step02V3ScoredStyle = Exclude<Step02V3Style, "auto">;

export const STEP02_V3_POINTS: Readonly<Record<Step02V3Level, number>> = {
  best: 5,
  fit: 3,
  support: 1,
  none: 0,
};

interface StylePlacement {
  readonly best: readonly string[];
  readonly fit: readonly string[];
  readonly support: readonly string[];
}

export const STEP02_V3_STYLE_PLACEMENTS: Readonly<
  Record<Step02V3ScoredStyle, StylePlacement>
> = {
  "family-leisure": {
    best: [
      "더 뉴 카니발", "더 뉴 카니발 HEV", "디 올 뉴 팰리세이드", "디 올 뉴 팰리세이드 HEV",
      "디 올 뉴 싼타페", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토", "더 뉴 쏘렌토 HEV",
      "더 EV9", "더 EV9 GT", "아이오닉 9", "스타리아", "스타리아 HEV", "더 뉴 스타리아",
      "더 뉴 스타리아 HEV", "더 뉴 스타리아 EV",
    ],
    fit: [
      "더 뉴 투싼", "더 뉴 투싼 HEV", "더 뉴 스포티지", "더 뉴 스포티지 HEV", "더 EV5",
      "더 EV5 GT", "더 뉴 아이오닉 5", "아이오닉 5 N", "렉스턴 뉴 아레나", "렉스턴 써밋",
      "더 뉴 토레스", "더 뉴 토레스 HEV", "토레스 EVX", "액티언", "액티언 HEV",
      "Electrified GV70 F/L",
    ],
    support: [
      "디 올 뉴 셀토스", "디 올 뉴 셀토스 HEV", "더 뉴 셀토스", "디 올 뉴 코나",
      "디 올 뉴 코나 HEV", "디 올 뉴 코나 EV", "더 뉴 티볼리", "무쏘 EV", "무쏘 Q300",
      "무쏘 스포츠 Q250", "무쏘 칸 Q250", "타스만", "GV70", "GV80 F/L", "GV80 Coupe",
      "디 올 뉴 넥쏘",
    ],
  },
  "city-compact": {
    best: ["더 뉴 모닝", "더 뉴 레이 PE", "더 레이 EV", "더 뉴 캐스퍼", "캐스퍼 일렉트릭", "베뉴"],
    fit: [
      "디 올 뉴 코나", "디 올 뉴 코나 HEV", "디 올 뉴 코나 EV", "디 올 뉴 셀토스",
      "디 올 뉴 셀토스 HEV", "더 뉴 셀토스", "더 뉴 티볼리", "더 EV3", "더 EV3 GT",
    ],
    support: [
      "더 뉴 아반떼", "더 뉴 아반떼 HEV", "더 EV4", "디 올 뉴 니로 HEV", "디 올 뉴 니로 EV",
      "더 뉴 니로 HEV", "GV60 F/L", "GV60 마그마",
    ],
  },
  "sedan-comfort": {
    best: [
      "더 뉴 아반떼", "더 뉴 아반떼 HEV", "더 뉴 K5", "더 뉴 K5 HEV", "쏘나타 디 엣지",
      "쏘나타 디 엣지 HEV", "더 뉴 그랜저", "더 뉴 그랜저 HEV", "디 올 뉴 그랜저",
      "디 올 뉴 그랜저 HEV", "The New K8", "The New K8 HEV",
    ],
    fit: [
      "더 뉴 G70", "G70 슈팅 브레이크", "더 뉴 아이오닉 6", "아이오닉 6 N", "더 EV4",
      "더 EV4 GT", "더 뉴 아반떼 N",
    ],
    support: ["더 뉴 EV6", "더 뉴 EV6 GT", "디 올 뉴 G80 F/L", "Electrified G80 F/L", "더 뉴 K9", "신형 G90"],
  },
  "low-running-cost": {
    best: [
      "더 뉴 아반떼 HEV", "더 뉴 K5 HEV", "쏘나타 디 엣지 HEV", "디 올 뉴 니로 HEV",
      "더 뉴 니로 HEV", "디 올 뉴 코나 HEV", "더 뉴 그랜저 HEV", "디 올 뉴 그랜저 HEV",
      "The New K8 HEV", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토 HEV", "더 뉴 카니발 HEV",
    ],
    fit: [
      "더 뉴 투싼 HEV", "더 뉴 스포티지 HEV", "디 올 뉴 셀토스 HEV", "디 올 뉴 팰리세이드 HEV",
      "더 뉴 아이오닉 5", "더 뉴 아이오닉 6", "더 뉴 EV6", "더 EV3", "더 EV4", "더 EV5",
      "디 올 뉴 니로 EV", "디 올 뉴 코나 EV", "캐스퍼 일렉트릭", "더 레이 EV", "액티언 HEV",
      "더 뉴 토레스 HEV", "토레스 EVX",
    ],
    support: [
      "더 EV9", "아이오닉 9", "Electrified G80 F/L", "Electrified GV70 F/L", "GV60 F/L",
      "디 올 뉴 넥쏘", "무쏘 EV", "더 뉴 스타리아 HEV", "더 뉴 스타리아 EV",
    ],
  },
  "premium-formal": {
    best: ["신형 G90", "디 올 뉴 G80 F/L", "Electrified G80 F/L", "GV80 F/L", "GV80 Coupe", "더 뉴 K9"],
    fit: ["GV70", "Electrified GV70 F/L", "GV60 F/L", "GV60 마그마", "더 뉴 G70", "G70 슈팅 브레이크"],
    support: [
      "더 뉴 그랜저", "디 올 뉴 그랜저", "더 뉴 그랜저 HEV", "디 올 뉴 그랜저 HEV",
      "The New K8", "The New K8 HEV", "아이오닉 9", "더 EV9 GT", "렉스턴 써밋",
    ],
  },
};

export const STEP02_V3_CHILD_BONUS: Readonly<Record<string, readonly string[]>> = {
  영유아: [
    "더 뉴 투싼", "더 뉴 투싼 HEV", "더 뉴 스포티지", "더 뉴 스포티지 HEV", "디 올 뉴 코나",
    "디 올 뉴 코나 HEV", "디 올 뉴 코나 EV", "디 올 뉴 셀토스", "디 올 뉴 셀토스 HEV",
    "더 뉴 셀토스", "더 EV5", "더 EV5 GT",
  ],
  미취학: [
    "디 올 뉴 싼타페", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토", "더 뉴 쏘렌토 HEV", "GV70",
    "Electrified GV70 F/L", "액티언", "액티언 HEV", "더 뉴 토레스", "더 뉴 토레스 HEV", "토레스 EVX",
  ],
  초등: [
    "디 올 뉴 팰리세이드", "디 올 뉴 팰리세이드 HEV", "더 EV9", "더 EV9 GT", "아이오닉 9",
    "GV80 F/L", "GV80 Coupe", "렉스턴 뉴 아레나", "렉스턴 써밋",
  ],
  "중학생+": [
    "더 뉴 그랜저", "더 뉴 그랜저 HEV", "디 올 뉴 그랜저", "디 올 뉴 그랜저 HEV", "The New K8",
    "The New K8 HEV", "신형 G90", "디 올 뉴 G80 F/L", "Electrified G80 F/L", "더 뉴 K9",
  ],
};

export const STEP02_V3_CARGO_BONUS: Readonly<Record<string, readonly string[]>> = {
  "소형 박스": [
    "디 올 뉴 코나", "디 올 뉴 코나 HEV", "디 올 뉴 코나 EV", "디 올 뉴 셀토스",
    "디 올 뉴 셀토스 HEV", "더 뉴 셀토스", "더 뉴 투싼", "더 뉴 투싼 HEV", "더 뉴 스포티지",
    "더 뉴 스포티지 HEV", "디 올 뉴 싼타페", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토",
    "더 뉴 쏘렌토 HEV", "디 올 뉴 팰리세이드", "디 올 뉴 팰리세이드 HEV", "GV70",
    "Electrified GV70 F/L", "GV80 F/L", "GV80 Coupe", "더 뉴 토레스", "더 뉴 토레스 HEV",
    "토레스 EVX", "액티언", "액티언 HEV", "렉스턴 뉴 아레나", "렉스턴 써밋", "더 EV3", "더 EV5",
    "더 뉴 EV6", "더 EV9", "더 뉴 아이오닉 5", "아이오닉 9", "더 뉴 티볼리", "베뉴",
  ],
  "대형 화물": [
    "더 뉴 카니발", "더 뉴 카니발 HEV", "스타리아", "스타리아 HEV", "더 뉴 스타리아",
    "더 뉴 스타리아 HEV", "더 뉴 스타리아 EV",
  ],
};

// PDF 표기와 현재 DB 최신 모델명의 차이를 명시적으로 고정한다.
export const STEP02_V3_DATABASE_NAME_ALIASES: Readonly<Record<string, string>> = {
  "더 뉴 토레스": "뉴 토레스",
  "더 뉴 토레스 HEV": "뉴 토레스 HEV",
};

function actualName(documentName: string): string {
  return STEP02_V3_DATABASE_NAME_ALIASES[documentName] ?? documentName;
}

// PDF의 확정 원칙은 같은 모델의 ICE/HEV/EV를 동일 가점으로 처리하도록 한다.
// 표 안에서 파워트레인별 등급이 다르면 문서의 계산 예시와 일치하는 기본
// 모델(각 배열 첫 항목)의 등급을 기준으로 삼는다. 기본 모델이 표에 없을
// 때만 기재된 파워트레인 중 가장 높은 등급을 공통 적용한다.
const STEP02_V3_POWERTRAIN_FAMILIES: readonly (readonly string[])[] = [
  ["더 뉴 카니발", "더 뉴 카니발 HEV"],
  ["디 올 뉴 팰리세이드", "디 올 뉴 팰리세이드 HEV"],
  ["디 올 뉴 싼타페", "디 올 뉴 싼타페 HEV"],
  ["더 뉴 쏘렌토", "더 뉴 쏘렌토 HEV"],
  ["스타리아", "스타리아 HEV"],
  ["더 뉴 스타리아", "더 뉴 스타리아 HEV", "더 뉴 스타리아 EV"],
  ["더 뉴 투싼", "더 뉴 투싼 HEV"],
  ["더 뉴 스포티지", "더 뉴 스포티지 HEV"],
  ["더 뉴 토레스", "더 뉴 토레스 HEV", "토레스 EVX"],
  ["액티언", "액티언 HEV"],
  ["디 올 뉴 셀토스", "디 올 뉴 셀토스 HEV"],
  ["디 올 뉴 코나", "디 올 뉴 코나 HEV", "디 올 뉴 코나 EV"],
  ["GV70", "Electrified GV70 F/L"],
  ["더 뉴 캐스퍼", "캐스퍼 일렉트릭"],
  ["더 뉴 레이 PE", "더 레이 EV"],
  ["더 뉴 아반떼", "더 뉴 아반떼 HEV"],
  ["더 뉴 K5", "더 뉴 K5 HEV"],
  ["쏘나타 디 엣지", "쏘나타 디 엣지 HEV"],
  ["더 뉴 그랜저", "더 뉴 그랜저 HEV"],
  ["디 올 뉴 그랜저", "디 올 뉴 그랜저 HEV"],
  ["The New K8", "The New K8 HEV"],
  ["디 올 뉴 니로 HEV", "디 올 뉴 니로 EV"],
  ["디 올 뉴 G80 F/L", "Electrified G80 F/L"],
] as const;

const normalizedPowertrainFamilies = STEP02_V3_POWERTRAIN_FAMILIES.map(
  (family) => family.map(actualName)
);
const powertrainFamilyByName = new Map<string, readonly string[]>();
for (const family of normalizedPowertrainFamilies) {
  for (const name of family) powertrainFamilyByName.set(name, family);
}

const LEVEL_PRIORITY: Readonly<Record<Step02V3Level, number>> = {
  none: 0,
  support: 1,
  fit: 2,
  best: 3,
};

function buildLevelByName(): Readonly<Record<Step02V3ScoredStyle, ReadonlyMap<string, Step02V3Level>>> {
  const result: Record<Step02V3ScoredStyle, Map<string, Step02V3Level>> = {
    "family-leisure": new Map(),
    "city-compact": new Map(),
    "sedan-comfort": new Map(),
    "low-running-cost": new Map(),
    "premium-formal": new Map(),
  };
  for (const style of Object.keys(STEP02_V3_STYLE_PLACEMENTS) as Step02V3ScoredStyle[]) {
    const placement = STEP02_V3_STYLE_PLACEMENTS[style];
    for (const level of ["best", "fit", "support"] as const) {
      for (const documentName of placement[level]) {
        result[style].set(actualName(documentName), level);
      }
    }
    for (const family of normalizedPowertrainFamilies) {
      const canonical = result[style].get(family[0]);
      const strongest = canonical ?? family.reduce<Step02V3Level>((current, name) => {
        const candidate = result[style].get(name) ?? "none";
        return LEVEL_PRIORITY[candidate] > LEVEL_PRIORITY[current] ? candidate : current;
      }, "none");
      if (strongest === "none") continue;
      for (const name of family) result[style].set(name, strongest);
    }
  }
  return result;
}

export const STEP02_V3_LEVEL_BY_NAME = buildLevelByName();

export const STEP02_V3_CATALOG_NAMES = new Set(
  Object.values(STEP02_V3_STYLE_PLACEMENTS)
    .flatMap((placement) => [...placement.best, ...placement.fit, ...placement.support])
    .map(actualName)
);

const childBonusNames = Object.fromEntries(
  Object.entries(STEP02_V3_CHILD_BONUS).map(([detail, names]) => [detail, new Set(names.map(actualName))])
) as Readonly<Record<string, ReadonlySet<string>>>;

const cargoBonusNames = Object.fromEntries(
  Object.entries(STEP02_V3_CARGO_BONUS).map(([detail, names]) => [detail, new Set(names.map(actualName))])
) as Readonly<Record<string, ReadonlySet<string>>>;

export function getStep02V3StyleLevel(
  style: Step02V3Style,
  vehicleName: string
): Step02V3Level {
  if (style === "auto") return "none";
  return STEP02_V3_LEVEL_BY_NAME[style].get(actualName(vehicleName)) ?? "none";
}

export function getStep02V3FollowupBonus(input: {
  readonly situationPreference?: string;
  readonly childDetail?: string;
  readonly cargoDetail?: string;
}, vehicleName: string): number {
  const normalizedVehicleName = actualName(vehicleName);
  const sameModelNames = powertrainFamilyByName.get(normalizedVehicleName)
    ?? [normalizedVehicleName];
  if (
    input.situationPreference === "가족"
    && input.childDetail
    && sameModelNames.some((name) => childBonusNames[input.childDetail!]?.has(name))
  ) return 3;
  if (
    input.situationPreference === "화물"
    && input.cargoDetail
    && sameModelNames.some((name) => cargoBonusNames[input.cargoDetail!]?.has(name))
  ) return 3;
  return 0;
}
