// 엑셀 견적기 트림(메리츠/MG) → 우리 DB 차량/트림 매칭(가격 확보용). 공유 매칭로직(trim-match) 재사용.
import { matchTrim, type MatchConfidence } from "../trim-match";

/** 매칭 입력(엑셀 캐피탈사 공통) */
export interface ExcelTrimLite { manufacturer: string; name: string }

/** 이름 정규화: 공백·특수문자·언더스코어(MG) 제거, 소문자. */
const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]/,._-]/g, "");
/** 세대 접두어(더 뉴/디 올 뉴/올 뉴/신형/The New/All New) 제거. */
const stripGen = (s: string) =>
  s.replace(/(디\s*올\s*뉴|올\s*뉴|더\s*뉴|the\s+all\s+new|all\s+new|the\s+new|신형)\s*/gi, "").trim();
/** 모델 코어 추출: 세대접두어·괄호코드·후미 연료/트림마커 제거 → 차량명의 모델 핵심. */
function modelCore(name: string): string {
  let s = stripGen(name).replace(/\([^)]*\)/g, " ");
  // 후미 연료/파생 마커 제거(HEV/EV/PHEV/LPG/LPI/N/PE 등)
  s = s.replace(/\b(phev|hev|ev|lpg|lpi|gdi|tci|n line|n라인|n)\b/gi, " ");
  return norm(s);
}

export interface OurVehicle {
  id: string;
  brand: string;
  name: string;
  trims: { id: string; name: string; price: number; lineupName: string | null }[];
}

export interface MeritzMatch {
  vehicleId: string;
  trimId: string;
  price: number;
  confidence: MatchConfidence;
  trimMatched: boolean; // false=모델만 일치, 트림은 첫 트림 가격 폴백(관리자 검토 요망)
}

/** 메리츠 제조사명 → 우리 DB 브랜드명(부분일치 후보). */
const BRAND_ALIASES: Record<string, string[]> = {
  현대: ["현대", "제네시스"], // 메리츠 현대 블록에 제네시스 포함 가능
  기아: ["기아"],
  KG: ["KG", "케이지", "쌍용", "KGM"],
  르노: ["르노"],
  쉐보레: ["쉐보레", "GM", "지엠"],
};

const brandMatches = (meritzMaker: string, ourBrand: string): boolean => {
  const aliases = BRAND_ALIASES[meritzMaker] ?? [meritzMaker];
  return aliases.some((a) => ourBrand.includes(a) || a.includes(ourBrand));
};

/**
 * 메리츠 트림 1건 → 우리 차량/트림 매칭. 같은 브랜드 우리 차량들 중 모델명 매칭 → 트림 토큰매칭.
 * 매칭 실패(모델 못찾음 또는 트림 unmatched) 시 null.
 */
export function matchMeritzTrim(input: ExcelTrimLite, ourVehicles: OurVehicle[]): MeritzMatch | null {
  const brandVehicles = ourVehicles.filter((v) => brandMatches(input.manufacturer, v.brand));
  if (brandVehicles.length === 0) return null;

  // 모델 매칭: 우리 차량의 모델코어가 트림명(정규화)에 포함 — 접두어/괄호코드/연료마커 무시, 최장 코어 우선.
  const mzNorm = norm(stripGen(input.name));
  const cand = brandVehicles
    .map((v) => ({ v, core: modelCore(v.name) }))
    .filter((x) => x.core.length >= 2 && mzNorm.includes(x.core))
    .sort((a, b) => b.core.length - a.core.length);
  if (cand.length === 0) return null;
  const vehicle = cand[0].v;
  if (vehicle.trims.length === 0) return null;

  // 트림 매칭: 트림명에서 모델코어 제거 → 트림 관련 토큰만 우리 (라인업+트림)과 매칭.
  const trimPart = stripGen(input.name).replace(new RegExp(vehicle.name.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi"), " ").trim() || input.name;
  const candidates = vehicle.trims.map((t) => ({ label: `${t.lineupName ?? ""} ${t.name}`.trim(), year: "" }));
  const m = matchTrim(trimPart, candidates);
  const idx = m ? m.index : 0; // 트림 토큰 불충분해도 첫 트림 가격으로 폴백(모델 일치=가격대 근사)
  const trim = vehicle.trims[idx];
  return { vehicleId: vehicle.id, trimId: trim.id, price: trim.price, confidence: m ? m.confidence : "fuzzy", trimMatched: !!m };
}
