// 차량 속성 추출 — 순수 함수 모듈 (DB 접근 없음)
// recommend 엔진이 차량/트림 데이터에서 추천 관련 속성을 도출할 때 사용한다.

// ─────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────

export interface AttrTrimInput {
  name: string;
  engineType: string; // EV | 하이브리드 | 디젤 | 가솔린 | LPG | 수소
  fuelEfficiency: number | null;
  price: number;
  detailedSpecs: unknown; // externalRaw.{carry, person, documents[].content}
  options: { name: string }[]; // TrimOption.name 목록
}

export interface AttrVehicleInput {
  name: string;
  category: string; // SUV | 세단 | 밴 | 트럭
  isPopular: boolean;
  slidingDoorOverride: boolean | null;
  advancedSafetyOverride: boolean | null;
}

// ─────────────────────────────────────────────
// 출력 타입
// ─────────────────────────────────────────────

export interface VehicleAttrs {
  isAwd: boolean;
  cargoKg: number | null;
  isRefrigerated: boolean;
  seating: number | null;
  fuel: "EV" | "하이브리드" | "디젤" | "가솔린" | "LPG" | "수소" | "기타";
  hasSlidingDoor: boolean;
  hasAdvancedSafety: boolean;
}

// ─────────────────────────────────────────────
// 1.1 AWD / 4WD 감지
// ─────────────────────────────────────────────

const AWD_RE = /\bAWD\b|\b4WD\b|4MATIC|4motion|사륜|x[Dd]rive|quattro|콰트로/i;

export function detectAwd(trimName: string): boolean {
  return AWD_RE.test(trimName);
}
