// 차량 속성 추출 — 순수 함수 모듈 (DB 접근 없음)
// recommend 엔진이 차량/트림 데이터에서 추천 관련 속성을 도출할 때 사용한다.

// ─────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────

export interface AttrTrimInput {
  name: string;
  engineType: string; // EV | 하이브리드 | 디젤 | 가솔린 | LPG | 수소
  detailedSpecs: unknown; // externalRaw.{carry, person, documents[].content}
  options: { name: string }[]; // TrimOption.name 목록
}

export interface AttrVehicleInput {
  name: string;
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
  isPopular: boolean;
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

const AWD_RE = /\bAWD\b|\b4WD\b|\b4MATIC\b|\b4motion\b|사륜|x[Dd]rive|quattro|콰트로/i;

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

const COLD_RE = /냉장|냉동|보냉/;

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

// ─────────────────────────────────────────────
// 1.3 슬라이딩 도어 판별 (override 우선)
// ─────────────────────────────────────────────

const SLIDING_DOOR_MODELS = ["카니발", "스타리아", "스타렉스", "쏠라티"];
const SLIDING_OPT_RE = /슬라이딩\s*도어|파워\s*슬라이딩|사이드\s*슬라이딩|양측\s*슬라이딩\s*도어/;

export function resolveSlidingDoor(p: {
  name: string;
  override: boolean | null;
  optionNames: string[];
}): boolean {
  if (p.override !== null) return p.override;
  if (SLIDING_DOOR_MODELS.some((m) => p.name.includes(m))) return true;
  return p.optionNames.some((o) => SLIDING_OPT_RE.test(o));
}

// ─────────────────────────────────────────────
// 1.3 고급 안전사양 판별 (override 우선)
// ─────────────────────────────────────────────

const SAFETY_RE = /전방\s*충돌방지\s*보조|차로\s*이탈|후측방\s*충돌|지능형\s*안전|긴급제동|\bFCA\b|\bBCW\b/;

export function resolveAdvancedSafety(p: {
  override: boolean | null;
  optionNames: string[];
  specText: string;
}): boolean {
  if (p.override !== null) return p.override;
  if (SAFETY_RE.test(p.specText)) return true;
  return p.optionNames.some((o) => SAFETY_RE.test(o));
}

// ─────────────────────────────────────────────
// 1.4 연료 정규화
// ─────────────────────────────────────────────

const FUELS = ["EV", "하이브리드", "디젤", "가솔린", "LPG", "수소"] as const;

function normalizeFuel(engineType: string): VehicleAttrs["fuel"] {
  return (FUELS as readonly string[]).includes(engineType)
    ? (engineType as VehicleAttrs["fuel"])
    : "기타";
}

// ─────────────────────────────────────────────
// 1.4 externalRaw.documents 텍스트 합성
// ─────────────────────────────────────────────

function specTextOf(detailedSpecs: unknown): string {
  const raw = rawOf(detailedSpecs);
  const docs = raw?.documents;
  if (!Array.isArray(docs)) return "";
  return docs
    .map((d) =>
      d && typeof d === "object"
        ? String((d as { content?: unknown }).content ?? "")
        : "",
    )
    .join(" ");
}

// ─────────────────────────────────────────────
// 1.4 VehicleAttrs 통합 빌더
// ─────────────────────────────────────────────

export function buildVehicleAttrs(
  v: AttrVehicleInput,
  t: AttrTrimInput,
): VehicleAttrs {
  const optionNames = t.options.map((o) => o.name);
  return {
    isAwd: detectAwd(t.name),
    cargoKg: extractCargoKg(t.detailedSpecs),
    isRefrigerated: detectRefrigerated(t.name),
    seating: extractSeating(t.detailedSpecs),
    fuel: normalizeFuel(t.engineType),
    hasSlidingDoor: resolveSlidingDoor({
      name: v.name,
      override: v.slidingDoorOverride,
      optionNames,
    }),
    hasAdvancedSafety: resolveAdvancedSafety({
      override: v.advancedSafetyOverride,
      optionNames,
      specText: specTextOf(t.detailedSpecs),
    }),
    isPopular: v.isPopular,
  };
}
