// 엑셀 견적기 트림(메리츠/MG) → 우리 DB 차량/트림 매칭(가격 확보용). 공유 매칭로직(trim-match) 재사용.
import { matchTrim, tokens, type MatchConfidence } from "../trim-match";

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
  trimMatched: boolean; // false=차종(연료·배기량·인승·차체)까지 일치, 등급은 base(최저가) 가격 폴백(관리자 검토 요망)
}

/** 메리츠 제조사명 → 우리 DB 브랜드명(부분일치 후보). */
const BRAND_ALIASES: Record<string, string[]> = {
  현대: ["현대", "제네시스"], // 메리츠 현대 블록에 제네시스 포함 가능
  기아: ["기아"],
  KG: ["KG", "케이지", "쌍용", "KGM"],
  르노: ["르노"],
  쉐보레: ["쉐보레", "GM", "지엠"],
  // 수입차 렌트 블록(영문/한글 이형)
  TESLA: ["테슬라", "TESLA", "Tesla"],
  폴스타: ["폴스타", "Polestar", "polestar"],
  BYD: ["BYD", "비야디"],
  // MG 수입견적 차량DB 브랜드(영문 표기) → 우리 DB 브랜드명
  AUDI: ["아우디"],
  BMW: ["BMW", "비엠더블유"],
  BENZ: ["벤츠", "메르세데스"],
  Volkswagen: ["폭스바겐"],
  LEXUS: ["렉서스"],
  HONDA: ["혼다"],
  VOLVO: ["볼보"],
  CADILLAC: ["캐딜락"],
  FORD: ["포드"],
  LINCOLN: ["링컨"],
  Jeep: ["지프"],
  PEUGEOT: ["푸조"],
  Citroen: ["시트로엥"],
  TOYOTA: ["토요타", "도요타"],
  PORSCHE: ["포르쉐"],
  "Jaguar-Landrover": ["재규어", "랜드로버"],
  Jaguar_Landrover: ["재규어", "랜드로버"],
  MINI: ["미니", "MINI"],
  Chevrolet: ["쉐보레", "GM", "지엠"],
  Lamborghini: ["람보르기니"],
  MASERATI: ["마세라티"],
  Bentley: ["벤틀리"],
  Ferrari: ["페라리"],
  ASTON_MARTIN: ["애스턴마틴", "애스톤마틴"],
  McLaren: ["맥라렌"],
  Rolls_Royce: ["롤스로이스"],
  // 메리츠 수입신차견적 차종 시트 표기 (재규어/랜드로버 단독 표기 등)
  Jaguar: ["재규어"],
  Landrover: ["랜드로버"],
  Astonmartine: ["애스턴마틴", "애스톤마틴"],
  Polestar: ["폴스타"],
  GMC: ["GMC", "지엠씨"],
};

/** 별칭 키 정규화 — 워크북마다 다른 표기(AUDI/Audi, Rolls_Royce/Rollsroyce, MG `_` 표기)를 하나로 흡수. */
const aliasKey = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
const ALIASES_BY_KEY = new Map<string, string[]>(Object.entries(BRAND_ALIASES).map(([k, v]) => [aliasKey(k), v]));

const brandMatches = (meritzMaker: string, ourBrand: string): boolean => {
  const aliases = ALIASES_BY_KEY.get(aliasKey(meritzMaker)) ?? [meritzMaker];
  return aliases.some((a) => ourBrand.includes(a) || a.includes(ourBrand));
};

/** 차체 구분(하이리무진/하이루프) — 가격대가 크게 달라 별도 판별(tokens() 에 없음). */
const bodyOf = (s: string) => (/하이\s*리무진/.test(s) ? "리무진" : /하이\s*루프/.test(s) ? "루프" : "");

/** 트림 전체 라벨: 차량명+라인업+트림 — 연료 표기가 차량명(HEV)·라인업(디젤 2.2) 어느 쪽에 있어도 잡히게. */
const trimLabel = (v: OurVehicle, t: OurVehicle["trims"][number]) => `${v.name} ${t.lineupName ?? ""} ${t.name}`.trim();

/** 엑셀 이름의 차종 토큰(연료·배기량·인승·차체)과 충돌하지 않는 트림만 — 어느 쪽에 없는 토큰은 제약 없음. */
function compatibleTrims(excelName: string, v: OurVehicle): OurVehicle["trims"] {
  const a = tokens(excelName);
  const bodyA = bodyOf(excelName);
  return v.trims.filter((t) => {
    const label = trimLabel(v, t);
    const b = tokens(label);
    if (a.engine && b.engine && a.engine !== b.engine) return false; // 하이브리드↔디젤 등
    if (a.disp && b.disp && a.disp !== b.disp) return false; // 2.2↔3.5 등
    if (a.seats && b.seats && a.seats !== b.seats) return false; // 7인승↔9인승 등
    if (bodyA !== bodyOf(label)) return false; // 하이리무진/하이루프/일반은 별개 차종
    return true;
  });
}

/**
 * 메리츠 트림 1건 → 우리 차량/트림 매칭. 같은 브랜드 우리 차량들 중 모델명 매칭 → 차종 토큰으로
 * 파생 차량·라인업 한정 → 등급 토큰 매칭. 매칭 실패(모델 못찾음) 시 null.
 */
export function matchMeritzTrim(input: ExcelTrimLite, ourVehicles: OurVehicle[]): MeritzMatch | null {
  const brandVehicles = ourVehicles.filter((v) => brandMatches(input.manufacturer, v.brand));
  if (brandVehicles.length === 0) return null;

  // 모델 매칭: 우리 차량의 모델코어가 트림명(정규화)에 포함 — 접두어/괄호코드/연료마커 무시, 최장 코어 우선.
  const mzNorm = norm(stripGen(input.name));
  const cand = brandVehicles
    .map((v) => ({ v, core: modelCore(v.name), compat: [] as OurVehicle["trims"] }))
    .filter((x) => x.core.length >= 2 && mzNorm.includes(x.core))
    .sort((a, b) => b.core.length - a.core.length);
  if (cand.length === 0) return null;
  for (const x of cand) x.compat = compatibleTrims(input.name, x.v);
  // 차종 토큰이 맞는 트림을 가진 차량 우선 — 코어가 같은 파생 차량("카니발 HEV" vs "카니발")을
  // 연료 등으로 구분. 전부 0개면 기존처럼 코어 최장 차량 유지.
  const picked = cand.find((x) => x.compat.length > 0) ?? cand[0];
  const vehicle = picked.v;
  // 등급 매칭·폴백 모두 차종이 맞는 트림 안에서만. 가격 오름차순 — 동점 시 base(최저가) 우선.
  const pool = (picked.compat.length > 0 ? picked.compat : vehicle.trims).slice().sort((a, b) => a.price - b.price);
  if (pool.length === 0) return null;

  // 트림(등급) 매칭: 트림명에서 모델코어 제거 → 등급 토큰이 있을 때만 시도.
  // 등급 토큰이 없으면(메리츠 국산 렌트가 대부분) 등급을 알 수 없어 차종 base 가격 폴백이 정답.
  const trimPart = stripGen(input.name).replace(new RegExp(vehicle.name.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi"), " ").trim() || input.name;
  const candidates = pool.map((t) => ({ label: trimLabel(vehicle, t), year: "" }));
  const m = tokens(trimPart).grade ? matchTrim(trimPart, candidates) : null;
  const trim = m ? pool[m.index] : pool[0];
  return { vehicleId: vehicle.id, trimId: trim.id, price: trim.price, confidence: m ? m.confidence : "fuzzy", trimMatched: !!m };
}
