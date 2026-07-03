// 라인업(연식/엔진) 드롭다운 정렬 — 일반 고객 주력 라인업을 상단에,
// 특수 목적(택시/장애인용/영업용 등) 라인업을 최하단에 배치한다.
// 분류 필드가 없어 라인업 이름 키워드로 판별한다 (DB 라인업 그룹 전수 조사 기반).

/** 일반 견적 대상이 아닌 특수 목적 라인업 키워드 — 최하단으로 보낸다. */
const SPECIAL_PURPOSE_KEYWORDS = [
  "택시",
  "장애인",
  "영업용",
  "렌터카",
  "특장",
  "구급",
  "휠체어",
  "어린이",
  "도너",
  "운전교습",
] as const;

/** 0 = 일반 주력(가솔린/일반판매 LPG), 1 = 기타, 2 = 특수 목적 */
export type LineupTier = 0 | 1 | 2;

export function getLineupTier(name: string): LineupTier {
  // 특수 키워드가 연료 키워드보다 우선한다 (예: "영업용 라운지 가솔린" → 특수)
  if (SPECIAL_PURPOSE_KEYWORDS.some((k) => name.includes(k))) return 2;
  if (name.includes("가솔린")) return 0;
  // "일반판매용 / 일반 판매 / 일반용" 등 표기 변형을 "일반" 포함 여부로 흡수
  if (/LPG|LPi/i.test(name) && name.includes("일반")) return 0;
  return 1;
}

/**
 * 라인업 드롭다운 정렬: 티어(일반 주력 → 기타 → 특수) 우선,
 * 같은 티어 안에서는 기존 규칙(그룹 등장 순서 + 연식 내림차순)을 유지한다.
 * 입력 배열은 변경하지 않고 새 배열을 반환한다.
 */
/** 연식 프리픽스("2024년형 ")를 제거한 차량군 그룹명. */
export function getLineupGroup(name: string): string {
  return name.replace(/^(?:20)?\d{2}년형\s*/, "");
}

export function getLineupYear(name: string): number {
  const fullYear = name.match(/20\d{2}/)?.[0];
  if (fullYear) return parseInt(fullYear, 10);
  const shortYear = name.match(/(?:^|\s)(\d{2})년형/)?.[1];
  return shortYear ? 2000 + parseInt(shortYear, 10) : 0;
}

/**
 * 같은 차량군(연식 프리픽스 제거 기준)에서 최신 연식 라인업 이름만 추린다.
 * 고객 노출용: 동일 차량군은 최신 연식 1개만 보여주기 위함.
 * 연식 표기가 없는 라인업(연식 0)은 그 그룹의 유일/최신으로 간주되어 그대로 유지된다.
 */
export function latestYearLineupNames(names: readonly string[]): Set<string> {
  const maxYearByGroup = new Map<string, number>();
  for (const n of names) {
    const g = getLineupGroup(n);
    const y = getLineupYear(n);
    maxYearByGroup.set(g, Math.max(maxYearByGroup.get(g) ?? -1, y));
  }
  return new Set(
    names.filter((n) => getLineupYear(n) === maxYearByGroup.get(getLineupGroup(n)))
  );
}

export function sortLineups(lineups: readonly string[]): string[] {
  const getYear = getLineupYear;
  const getGroup = getLineupGroup;

  const groupOrder: string[] = [];
  for (const l of lineups) {
    const g = getGroup(l);
    if (!groupOrder.includes(g)) groupOrder.push(g);
  }

  return [...lineups].sort((a, b) => {
    const ga = getGroup(a);
    const gb = getGroup(b);
    const tierDiff = getLineupTier(ga) - getLineupTier(gb);
    if (tierDiff !== 0) return tierDiff;
    const groupDiff = groupOrder.indexOf(ga) - groupOrder.indexOf(gb);
    if (groupDiff !== 0) return groupDiff;
    return getYear(b) - getYear(a);
  });
}
