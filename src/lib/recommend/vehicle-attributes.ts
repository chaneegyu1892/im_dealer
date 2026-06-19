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
// 내부 헬퍼
// ─────────────────────────────────────────────

function rawOf(detailedSpecs: unknown): Record<string, unknown> | null {
  if (!detailedSpecs || typeof detailedSpecs !== "object") return null;
  const raw = (detailedSpecs as { externalRaw?: unknown }).externalRaw;
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

// ─────────────────────────────────────────────
// 1.1 AWD / 4WD 감지
// ─────────────────────────────────────────────

const AWD_RE = /\bAWD\b|\b4WD\b|4MATIC|4motion|사륜|x[Dd]rive|quattro|콰트로/i;

export function detectAwd(trimName: string): boolean {
  return AWD_RE.test(trimName);
}

// ─────────────────────────────────────────────
// 1.2 적재중량 추출
// ─────────────────────────────────────────────

export function extractCargoKg(detailedSpecs: unknown): number | null {
  const raw = rawOf(detailedSpecs);
  const n = raw ? Number(raw.carry) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─────────────────────────────────────────────
// 1.2 냉장·냉동·특장차 감지
// ─────────────────────────────────────────────

const COLD_RE = /냉장|냉동|탑차|윙바디|보냉/;

export function detectRefrigerated(trimName: string): boolean {
  return COLD_RE.test(trimName);
}

// ─────────────────────────────────────────────
// 1.2 승차인원 추출
// ─────────────────────────────────────────────

export function extractSeating(detailedSpecs: unknown): number | null {
  const raw = rawOf(detailedSpecs);
  const n = raw ? Number(raw.person) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
