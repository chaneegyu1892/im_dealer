export type CatalogLevel = "best" | "fit" | "support";
export type CatalogFuelGroup = "EV" | "HEV" | "ICE";
export type CatalogBodyClass = "sedan" | "suv" | "van" | "other";

export interface PdfPlacement {
  readonly axis: "industry" | "primaryPreference" | "additionalCondition" | "annualMileage" | "region";
  readonly answer: string;
  readonly level: CatalogLevel;
  readonly vehicles: readonly string[];
}

export interface CatalogFacts {
  readonly bodyClass: CatalogBodyClass;
  readonly seating: number | null;
  readonly slidingDoor: boolean | null;
  readonly advancedSafety: boolean | null;
  readonly cargoKg: number | null;
  readonly sourceNote: string;
}

export interface CatalogVehicleSource {
  readonly documentName: string;
  readonly slug: string;
  readonly fuelGroup: CatalogFuelGroup;
  readonly activationIntent: "active";
  readonly facts: CatalogFacts;
}

export interface EvChargingEvidence {
  readonly documentName: string;
  readonly sourceUrl: string;
  readonly accessedAt: "2026-07-12";
  readonly conservativeVariant: string;
  readonly certifiedCombinedRangeKm: number;
  readonly acChargingKw: number;
  readonly dcPeakKw: number | null;
  readonly dcTenToEightyMinutes: number | null;
}

export const PDF_PLACEMENTS: readonly PdfPlacement[] = [
  { axis: "industry", answer: "법인", level: "best", vehicles: ["디 올 뉴 G80 F/L", "더 뉴 그랜저 HEV", "The New K8 HEV"] },
  { axis: "industry", answer: "법인", level: "fit", vehicles: ["GV80 F/L", "신형 G90", "더 뉴 K9", "디 올 뉴 그랜저"] },
  { axis: "industry", answer: "법인", level: "support", vehicles: ["GV70", "쏘나타 디 엣지 HEV", "더 뉴 K5 HEV"] },
  { axis: "industry", answer: "개인사업자", level: "best", vehicles: ["더 뉴 쏘렌토 HEV", "디 올 뉴 싼타페 HEV", "더 뉴 카니발 HEV"] },
  { axis: "industry", answer: "개인사업자", level: "fit", vehicles: ["더 뉴 스타리아 HEV", "디 올 뉴 코나 HEV", "더 뉴 스포티지 HEV", "디 올 뉴 셀토스 HEV"] },
  { axis: "industry", answer: "개인사업자", level: "support", vehicles: ["더 뉴 쏘렌토", "디 올 뉴 싼타페", "더 뉴 카니발"] },
  { axis: "industry", answer: "개인", level: "best", vehicles: ["디 올 뉴 코나 HEV", "더 뉴 셀토스", "더 뉴 아반떼 HEV"] },
  { axis: "industry", answer: "개인", level: "fit", vehicles: ["더 뉴 스포티지 HEV", "더 뉴 캐스퍼", "더 뉴 K5 HEV", "디 올 뉴 니로 HEV"] },
  { axis: "industry", answer: "개인", level: "support", vehicles: ["베뉴", "더 뉴 모닝", "디 올 뉴 코나"] },

  { axis: "primaryPreference", answer: "안정감", level: "best", vehicles: ["GV80 F/L", "디 올 뉴 팰리세이드", "디 올 뉴 싼타페"] },
  { axis: "primaryPreference", answer: "안정감", level: "fit", vehicles: ["더 뉴 쏘렌토", "더 뉴 카니발", "GV70", "더 뉴 스타리아"] },
  { axis: "primaryPreference", answer: "안정감", level: "support", vehicles: ["더 뉴 스포티지", "더 뉴 투싼", "디 올 뉴 코나"] },
  { axis: "primaryPreference", answer: "주차편의", level: "best", vehicles: ["더 뉴 캐스퍼", "더 뉴 모닝", "베뉴"] },
  { axis: "primaryPreference", answer: "주차편의", level: "fit", vehicles: ["더 뉴 레이 PE", "디 올 뉴 코나", "더 뉴 셀토스", "디 올 뉴 셀토스"] },
  { axis: "primaryPreference", answer: "주차편의", level: "support", vehicles: ["더 뉴 아반떼", "더 뉴 K5", "더 EV3"] },
  { axis: "primaryPreference", answer: "경제성", level: "best", vehicles: ["더 뉴 아반떼 HEV", "디 올 뉴 코나 HEV", "디 올 뉴 니로 HEV"] },
  { axis: "primaryPreference", answer: "경제성", level: "fit", vehicles: ["더 뉴 K5 HEV", "쏘나타 디 엣지 HEV", "디 올 뉴 셀토스 HEV", "더 뉴 스포티지 HEV"] },
  { axis: "primaryPreference", answer: "경제성", level: "support", vehicles: ["더 뉴 아반떼", "디 올 뉴 코나", "더 뉴 셀토스"] },
  { axis: "primaryPreference", answer: "고급", level: "best", vehicles: ["신형 G90", "디 올 뉴 G80 F/L", "GV80 F/L"] },
  { axis: "primaryPreference", answer: "고급", level: "fit", vehicles: ["GV80 Coupe", "더 뉴 K9", "GV70", "Electrified G80 F/L"] },
  { axis: "primaryPreference", answer: "고급", level: "support", vehicles: ["The New K8", "더 뉴 그랜저", "G70 슈팅 브레이크"] },

  { axis: "additionalCondition", answer: "가족", level: "best", vehicles: ["더 뉴 카니발 HEV", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토 HEV"] },
  { axis: "additionalCondition", answer: "가족", level: "fit", vehicles: ["디 올 뉴 팰리세이드", "더 뉴 스타리아 HEV", "더 뉴 카니발", "더 뉴 쏘렌토"] },
  { axis: "additionalCondition", answer: "가족", level: "support", vehicles: ["더 뉴 스포티지 HEV", "더 뉴 투싼 HEV", "GV70"] },
  { axis: "additionalCondition", answer: "화물", level: "best", vehicles: ["더 뉴 카니발", "더 뉴 스타리아", "디 올 뉴 팰리세이드"] },
  { axis: "additionalCondition", answer: "화물", level: "fit", vehicles: ["디 올 뉴 싼타페", "더 뉴 쏘렌토", "더 뉴 카니발 HEV", "더 뉴 스타리아 HEV"] },
  { axis: "additionalCondition", answer: "화물", level: "support", vehicles: ["GV80 F/L", "디 올 뉴 코나", "더 뉴 스포티지"] },

  { axis: "annualMileage", answer: "10000", level: "best", vehicles: ["더 뉴 아반떼 HEV", "디 올 뉴 코나 HEV", "디 올 뉴 니로 HEV"] },
  { axis: "annualMileage", answer: "10000", level: "fit", vehicles: ["더 뉴 셀토스", "더 뉴 캐스퍼", "디 올 뉴 코나", "더 뉴 아반떼"] },
  { axis: "annualMileage", answer: "10000", level: "support", vehicles: ["더 뉴 모닝", "베뉴", "더 EV3"] },
  { axis: "annualMileage", answer: "20000", level: "best", vehicles: ["디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토 HEV", "쏘나타 디 엣지 HEV"] },
  { axis: "annualMileage", answer: "20000", level: "fit", vehicles: ["The New K8 HEV", "더 뉴 카니발 HEV", "더 뉴 그랜저 HEV", "더 뉴 스포티지 HEV"] },
  { axis: "annualMileage", answer: "20000", level: "support", vehicles: ["더 뉴 쏘렌토", "디 올 뉴 싼타페", "더 뉴 카니발"] },
  { axis: "annualMileage", answer: "30000", level: "best", vehicles: ["더 뉴 그랜저 HEV", "The New K8 HEV", "디 올 뉴 싼타페 HEV"] },
  { axis: "annualMileage", answer: "30000", level: "fit", vehicles: ["더 뉴 쏘렌토 HEV", "쏘나타 디 엣지 HEV", "더 뉴 카니발 HEV", "디 올 뉴 코나 HEV"] },
  { axis: "annualMileage", answer: "30000", level: "support", vehicles: ["더 뉴 그랜저", "The New K8", "디 올 뉴 싼타페"] },

  { axis: "region", answer: "일반", level: "best", vehicles: ["디 올 뉴 코나 HEV", "디 올 뉴 싼타페 HEV", "더 뉴 쏘렌토 HEV"] },
  { axis: "region", answer: "일반", level: "fit", vehicles: ["더 뉴 그랜저 HEV", "더 뉴 셀토스", "더 뉴 스포티지 HEV", "디 올 뉴 코나"] },
  { axis: "region", answer: "일반", level: "support", vehicles: ["더 뉴 아반떼 HEV", "더 뉴 K5 HEV", "더 EV3"] },
  { axis: "region", answer: "강원·산간", level: "best", vehicles: ["GV70", "GV80 F/L", "디 올 뉴 팰리세이드"] },
  { axis: "region", answer: "강원·산간", level: "fit", vehicles: ["디 올 뉴 싼타페", "더 뉴 쏘렌토", "더 뉴 스포티지", "더 뉴 투싼"] },
  { axis: "region", answer: "강원·산간", level: "support", vehicles: ["디 올 뉴 코나", "더 뉴 셀토스", "더 뉴 스타리아"] },
  { axis: "region", answer: "제주", level: "best", vehicles: ["더 뉴 아이오닉 5", "더 EV3", "더 뉴 EV6"] },
  { axis: "region", answer: "제주", level: "fit", vehicles: ["디 올 뉴 코나 EV", "아이오닉 9", "더 EV5", "디 올 뉴 니로 EV"] },
  { axis: "region", answer: "제주", level: "support", vehicles: ["캐스퍼 일렉트릭", "더 레이 EV", "GV60 F/L"] },
];

const reviewed = (bodyClass: CatalogBodyClass, seating: number | null, slidingDoor: boolean | null, advancedSafety: boolean | null): CatalogFacts => ({
  bodyClass,
  seating,
  slidingDoor,
  advancedSafety,
  cargoKg: null,
  sourceNote: "제조사 제원 및 현재 DB 차종 분류 수동 검토 (2026-07-12)",
});

const CATALOG_VEHICLE_ROWS = [
  ["Electrified G80 F/L", "genesis-11708", "EV", reviewed("sedan", 5, false, true)],
  ["G70 슈팅 브레이크", "genesis-11098", "ICE", reviewed("sedan", 5, false, true)],
  ["GV60 F/L", "genesis-11759", "EV", reviewed("suv", 5, false, true)],
  ["GV70", "genesis-10534", "ICE", reviewed("suv", 5, false, true)],
  ["GV80 Coupe", "genesis-11594", "ICE", reviewed("suv", 5, false, true)],
  ["GV80 F/L", "genesis-11593", "ICE", reviewed("suv", 7, false, true)],
  ["The New K8", "kia-11701", "ICE", reviewed("sedan", 5, false, true)],
  ["The New K8 HEV", "kia-11702", "HEV", reviewed("sedan", 5, false, true)],
  ["더 EV3", "kia-11681", "EV", reviewed("suv", 5, false, true)],
  ["더 EV5", "kia-11818", "EV", reviewed("suv", 5, false, true)],
  ["더 뉴 EV6", "kia-11676", "EV", reviewed("suv", 5, false, true)],
  ["더 뉴 K5", "kia-11597", "ICE", reviewed("sedan", 5, false, true)],
  ["더 뉴 K5 HEV", "kia-11598", "HEV", reviewed("sedan", 5, false, true)],
  ["더 뉴 K9", "kia-10999", "ICE", reviewed("sedan", 5, false, true)],
  ["더 뉴 그랜저", "hyundai-11874", "ICE", reviewed("sedan", 5, false, true)],
  ["더 뉴 그랜저 HEV", "hyundai-11875", "HEV", reviewed("sedan", 5, false, true)],
  ["더 뉴 레이 PE", "kia-11116", "ICE", reviewed("van", 5, true, true)],
  ["더 뉴 모닝", "kia-11562", "ICE", reviewed("other", 5, false, true)],
  ["더 뉴 셀토스", "kia-11104", "ICE", reviewed("suv", 5, false, true)],
  ["더 뉴 스타리아", "hyundai-11834", "ICE", reviewed("van", 9, true, true)],
  ["더 뉴 스타리아 HEV", "hyundai-11835", "HEV", reviewed("van", 9, true, true)],
  ["더 뉴 스포티지", "kia-11722", "ICE", reviewed("suv", 5, false, true)],
  ["더 뉴 스포티지 HEV", "kia-11723", "HEV", reviewed("suv", 5, false, true)],
  ["더 뉴 쏘렌토", "kia-11572", "ICE", reviewed("suv", 7, false, true)],
  ["더 뉴 쏘렌토 HEV", "kia-11573", "HEV", reviewed("suv", 7, false, true)],
  ["더 뉴 아반떼", "hyundai-11414", "ICE", reviewed("sedan", 5, false, true)],
  ["더 뉴 아반떼 HEV", "hyundai-11415", "HEV", reviewed("sedan", 5, false, true)],
  ["더 뉴 아이오닉 5", "hyundai-11664", "EV", reviewed("suv", 5, false, true)],
  ["더 뉴 카니발", "kia-11605", "ICE", reviewed("van", 9, true, true)],
  ["더 뉴 카니발 HEV", "kia-11606", "HEV", reviewed("van", 9, true, true)],
  ["더 뉴 캐스퍼", "hyundai-11716", "ICE", reviewed("other", 5, false, true)],
  ["더 뉴 투싼", "hyundai-11609", "ICE", reviewed("suv", 5, false, true)],
  ["더 뉴 투싼 HEV", "hyundai-11610", "HEV", reviewed("suv", 5, false, true)],
  ["더 레이 EV", "kia-11580", "EV", reviewed("van", 5, true, true)],
  ["디 올 뉴 G80 F/L", "genesis-11644", "ICE", reviewed("sedan", 5, false, true)],
  ["디 올 뉴 그랜저", "hyundai-11260", "ICE", reviewed("sedan", 5, false, true)],
  ["디 올 뉴 니로 EV", "kia-11085", "EV", reviewed("suv", 5, false, true)],
  ["디 올 뉴 니로 HEV", "kia-11063", "HEV", reviewed("suv", 5, false, true)],
  ["디 올 뉴 셀토스", "kia-11844", "ICE", reviewed("suv", 5, false, true)],
  ["디 올 뉴 셀토스 HEV", "kia-11845", "HEV", reviewed("suv", 5, false, true)],
  ["디 올 뉴 싼타페", "hyundai-11575", "ICE", reviewed("suv", 7, false, true)],
  ["디 올 뉴 싼타페 HEV", "hyundai-11576", "HEV", reviewed("suv", 7, false, true)],
  ["디 올 뉴 코나", "hyundai-11396", "ICE", reviewed("suv", 5, false, true)],
  ["디 올 뉴 코나 EV", "hyundai-11427", "EV", reviewed("suv", 5, false, true)],
  ["디 올 뉴 코나 HEV", "hyundai-11397", "HEV", reviewed("suv", 5, false, true)],
  ["디 올 뉴 팰리세이드", "hyundai-11735", "ICE", reviewed("suv", 7, false, true)],
  ["베뉴", "hyundai-10345", "ICE", reviewed("suv", 5, false, true)],
  ["신형 G90", "genesis-11054", "ICE", reviewed("sedan", 5, false, true)],
  ["쏘나타 디 엣지 HEV", "hyundai-11463", "HEV", reviewed("sedan", 5, false, true)],
  ["아이오닉 9", "hyundai-11744", "EV", reviewed("suv", 7, false, true)],
  ["캐스퍼 일렉트릭", "hyundai-11689", "EV", reviewed("other", 5, false, true)],
] satisfies readonly (readonly [string, string, CatalogFuelGroup, CatalogFacts])[];

export const CATALOG_VEHICLES: readonly CatalogVehicleSource[] = CATALOG_VEHICLE_ROWS.map(([
  documentName,
  slug,
  fuelGroup,
  facts,
]): CatalogVehicleSource => ({
  documentName,
  slug,
  fuelGroup,
  facts,
  activationIntent: "active",
}));

export const EV_CHARGING_EVIDENCE: readonly EvChargingEvidence[] = [
  { documentName: "Electrified G80 F/L", sourceUrl: "https://www.genesis.com/kr/ko/models/electrified-g80", accessedAt: "2026-07-12", conservativeVariant: "19인치 AWD", certifiedCombinedRangeKm: 475, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 25 },
  { documentName: "더 EV3", sourceUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/catalog/catalog_ev3.pdf", accessedAt: "2026-07-12", conservativeVariant: "스탠다드 19인치", certifiedCombinedRangeKm: 347, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 31 },
  { documentName: "더 뉴 아이오닉 5", sourceUrl: "https://www.hyundai.com/kr/ko/e/vehicles/ioniq5/intro", accessedAt: "2026-07-12", conservativeVariant: "AWD 20인치", certifiedCombinedRangeKm: 411, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 18 },
  { documentName: "더 뉴 EV6", sourceUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/catalog/catalog_ev6.pdf", accessedAt: "2026-07-12", conservativeVariant: "AWD 20인치", certifiedCombinedRangeKm: 432, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 18 },
  { documentName: "디 올 뉴 코나 EV", sourceUrl: "https://www.hyundai.com/kr/ko/e/vehicles/kona-electric/intro", accessedAt: "2026-07-12", conservativeVariant: "스탠다드 17인치", certifiedCombinedRangeKm: 311, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 39 },
  { documentName: "아이오닉 9", sourceUrl: "https://www.hyundai.com/kr/ko/e/vehicles/ioniq9/intro", accessedAt: "2026-07-12", conservativeVariant: "성능형 AWD 21인치", certifiedCombinedRangeKm: 501, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 24 },
  { documentName: "더 EV5", sourceUrl: "https://www.kia.com/kr/vehicles/ev5/specification", accessedAt: "2026-07-12", conservativeVariant: "스탠다드 19인치", certifiedCombinedRangeKm: 342, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 30 },
  { documentName: "디 올 뉴 니로 EV", sourceUrl: "https://www.kia.com/content/dam/kwp/kr/ko/vehicles/pdf/price/price_niro-ev.pdf", accessedAt: "2026-07-12", conservativeVariant: "2WD", certifiedCombinedRangeKm: 401, acChargingKw: 11, dcPeakKw: 85, dcTenToEightyMinutes: 43 },
  { documentName: "캐스퍼 일렉트릭", sourceUrl: "https://casper.hyundai.com/vehicles/electric/spec", accessedAt: "2026-07-12", conservativeVariant: "2026년형 활성 요율 트림 전체", certifiedCombinedRangeKm: 248, acChargingKw: 11, dcPeakKw: 120, dcTenToEightyMinutes: 30 },
  { documentName: "더 레이 EV", sourceUrl: "https://www.kia.com/kr/vehicles/ray-ev/specification", accessedAt: "2026-07-12", conservativeVariant: "EV 14인치", certifiedCombinedRangeKm: 205, acChargingKw: 7, dcPeakKw: null, dcTenToEightyMinutes: 40 },
  { documentName: "GV60 F/L", sourceUrl: "https://www.genesis.com/kr/ko/models/luxury-suv-genesis/gv60/specs.html", accessedAt: "2026-07-12", conservativeVariant: "퍼포먼스 AWD 21인치", certifiedCombinedRangeKm: 382, acChargingKw: 11, dcPeakKw: null, dcTenToEightyMinutes: 18 },
];
