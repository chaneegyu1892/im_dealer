/**
 * 캐피탈사 트림/모델 이름 매칭 — 워커 어댑터(ORIX 등)와 백엔드 자동 제안 API 가 공유.
 * 로직은 scripts/scraper-worker/adapters/orix.ts 에서 이관 (동작 불변).
 */

export type MatchConfidence = "exact" | "fuzzy";

/** 카탈로그 후보 (사이트 중립): label=외부 트림명(MDEL_NAME2 등), year=외부 연식(MDEL_YEAR 등) */
export interface CatalogCandidate {
  label: string;
  year?: string;
}

// 등급 사전 — canon(정규화 값)과 표기 이형(keys). 순서 중요: 긴/구체적 등급 먼저 (부분문자열 오인 방지).
// 한글·영문 이형은 같은 canon 으로 수렴시켜 언어가 달라도 등급 일치로 판정한다.
const GRADE_DEFS: { canon: string; keys: string[] }[] = [
  { canon: "시그니처 x-line", keys: ["시그니처x-line"] },
  { canon: "캘리그래피 블랙 잉크", keys: ["캘리그래피블랙잉크"] },
  { canon: "캘리그래피 블랙 익스테리어", keys: ["캘리그래피블랙익스테리어"] },
  { canon: "캘리그래피", keys: ["캘리그래피"] },
  { canon: "시그니처", keys: ["시그니처"] },
  { canon: "노블레스", keys: ["노블레스"] },
  { canon: "프레스티지", keys: ["프레스티지"] },
  { canon: "익스클루시브", keys: ["익스클루시브"] },
  { canon: "프리미엄", keys: ["프리미엄"] },
  { canon: "인스퍼레이션", keys: ["인스퍼레이션"] },
  { canon: "아너스", keys: ["아너스"] },
  // 쉐보레 계열 (영문/한글 이형)
  { canon: "redline", keys: ["redline", "레드라인"] },
  { canon: "activ", keys: ["activ", "액티브"] },
  { canon: "premier", keys: ["premier", "프리미어"] },
  { canon: "ltz", keys: ["ltz"] },
  { canon: "lt", keys: ["lt"] },
  { canon: "ls", keys: ["ls"] },
  { canon: "rs", keys: ["rs"] },
];

export function norm(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, "");
}

export interface TrimTokens {
  disp: string;
  seats: string;
  drive: string;
  engine: string;
  grade: string;
  nline: string;
  range: string;
}

export function tokens(name: string): TrimTokens {
  const n = (name || "").toLowerCase();
  const nn = n.replace(/\s+/g, "");
  const disp = n.match(/(\d\.\d)/)?.[1] ?? "";
  const seats = n.match(/(\d)\s*인승/)?.[1] ?? "";
  const drive = /4wd|awd/.test(n) ? "4wd" : /2wd|fwd/.test(n) ? "2wd" : "";
  const engine = /하이브리드|hev/.test(n) ? "hev" : /디젤|diesel/.test(n) ? "diesel" : /lpg|엘피지/.test(n) ? "lpg" : /전기|ev\b/.test(n) ? "ev" : /가솔린|gasoline/.test(n) ? "gas" : "";
  const grade = GRADE_DEFS.find((g) => g.keys.some((k) => nn.includes(k)))?.canon ?? "";
  const nline = /n[\s-]?line|n라인/.test(n) ? "1" : "0"; // N Line 은 가격·잔존율이 다른 별도 트림
  const range = /롱레인지|long\s*range/.test(n) ? "long" : /스탠다드|standard/.test(n) ? "std" : ""; // EV 배터리 등급
  return { disp, seats, drive, engine, grade, nline, range };
}

/** 우리 트림명 → 카탈로그 후보 토큰 매칭. 반환은 candidates 의 index (호출측이 원본 레코드를 되찾음).
 *  등급이 같은 후보끼리는 점수제(배기량·연료·구동·인승), 등급 표기가 서로 있고 다르면 제외. */
export function matchTrim(
  ourName: string,
  candidates: CatalogCandidate[]
): { index: number; confidence: MatchConfidence } | null {
  const a = tokens(ourName);
  const yearA = ourName.match(/(20\d{2})/)?.[1] ?? ""; // 우리 트림 연식 (예: "2025년형" → "2025")
  let best: { index: number; score: number; full: boolean } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const b = tokens(c.label);
    const yearB = (c.year ?? "").trim();
    if (yearA && yearB && yearA !== yearB) continue; // 연식 다르면 제외 — 해당 연식 없으면 매칭 실패("없음")
    if (a.grade && b.grade && a.grade !== b.grade) continue; // 등급 다르면 제외
    if (a.engine && b.engine && a.engine !== b.engine) continue; // 연료 다르면 제외 (LPG↔가솔린 등)
    if (a.disp && b.disp && a.disp !== b.disp) continue; // 배기량 다르면 제외 (2.5↔3.5 등)
    if (a.nline !== b.nline) continue; // N Line ↔ 일반 제외 (가격·잔존율 다른 별도 트림)
    if (a.range && b.range && a.range !== b.range) continue; // 롱레인지↔스탠다드 제외 (EV 배터리 등급)
    let score = 0;
    if (a.grade && a.grade === b.grade) score += 3;
    if (a.disp && a.disp === b.disp) score += 2;
    if (a.engine && a.engine === b.engine) score += 2;
    if (a.drive && a.drive === b.drive) score += 1;
    if (a.seats && a.seats === b.seats) score += 1;
    const full = a.grade === b.grade && a.disp === b.disp && a.drive === b.drive && a.seats === b.seats && (!a.engine || a.engine === b.engine);
    if (!best || score > best.score) best = { index: i, score, full };
  }
  if (!best || best.score < 4) return null;
  return { index: best.index, confidence: best.full ? "exact" : "fuzzy" };
}

/**
 * 우리 차량명 → 캐피탈사 모델명 매칭. 반환은 modelNames 의 index.
 * 캐피탈사 모델명은 짧은 정식명(예: "G80", "그랜저"), 우리 차량명은 마케팅 이름("디 올 뉴 G80 F/L")일 수 있다.
 * 1) 완전일치 → 2) 외부명이 우리명을 포함 → 3) 우리명이 외부명을 포함(긴 외부명 우선; "GV80"이 "G80"보다 먼저).
 */
export function findModelIndex(ourVehicleName: string, modelNames: string[]): number {
  const nOur = norm(ourVehicleName);
  let idx = modelNames.findIndex((m) => norm(m) === nOur);
  if (idx >= 0) return idx;
  idx = modelNames.findIndex((m) => norm(m).includes(nOur));
  if (idx >= 0) return idx;
  const byLenDesc = modelNames
    .map((m, i) => ({ nm: norm(m), i }))
    .sort((a, b) => b.nm.length - a.nm.length);
  const hit = byLenDesc.find(({ nm }) => nm.length >= 2 && nOur.includes(nm));
  return hit ? hit.i : -1;
}
