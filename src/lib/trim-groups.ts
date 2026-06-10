// 트림 셀렉트의 라인업별 그룹핑 — 비교 패널 등 평면 트림 리스트에서
// "프리미엄 — 4,250 / 프리미엄 — 4,398" 처럼 동명 트림이 구분 없이 섞여 보이던 문제를
// 라인업 헤더(optgroup) + 그룹 내 보조 라벨로 해소한다. 그룹 순서는 lineup-sort 규칙을 따른다.

import { sortLineups } from "./lineup-sort";

/** 그룹핑에 필요한 최소 트림 형태 (QuoteClientPage TrimData / ComparisonTrimData 호환) */
export interface GroupableTrim {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  specs?: Record<string, string> | null;
  lineup?: { id: string; name: string } | null;
}

export interface GroupedTrim<T extends GroupableTrim = GroupableTrim> {
  trim: T;
  id: string;
  /** 등급명 (specs.trimName 우선, 없으면 name) */
  displayName: string;
  /** 같은 그룹 내 동명 트림 구분용 잔여 텍스트 (연식/엔진 등), 없으면 null */
  extra: string | null;
}

export interface TrimGroup<T extends GroupableTrim = GroupableTrim> {
  /** 라인업 이름. 라인업 정보가 없는 차량이면 null (헤더 없이 평면 노출) */
  lineup: string | null;
  trims: GroupedTrim<T>[];
}

function lineupNameOf(t: GroupableTrim): string {
  return t.lineup?.name ?? t.specs?.lineup ?? "";
}

function displayNameOf(t: GroupableTrim): string {
  return t.specs?.trimName ?? t.name;
}

/**
 * 트림 목록을 라인업별 그룹으로 변환한다.
 * - 그룹 순서: sortLineups (일반 주력 → 기타 → 특수목적 최하단)
 * - 그룹 내 트림 순서: 입력 순서 유지 (API 의 isDefault desc, price asc)
 * - 같은 그룹 안에 동명 트림이 있으면 name 의 잔여 텍스트를 보조 라벨(extra)로 제공
 */
export function groupTrimsByLineup<T extends GroupableTrim>(
  trims: readonly T[]
): TrimGroup<T>[] {
  const hasLineup = trims.some((t) => lineupNameOf(t));

  const toGrouped = (list: readonly T[]): GroupedTrim<T>[] => {
    const nameCount = new Map<string, number>();
    for (const t of list) {
      const n = displayNameOf(t);
      nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
    }
    return list.map((t) => {
      const displayName = displayNameOf(t);
      const isDuplicated = (nameCount.get(displayName) ?? 0) > 1;
      const extra =
        isDuplicated && t.name !== displayName && t.name.includes(displayName)
          ? t.name.replace(displayName, "").trim().replace(/\s+/g, " ")
          : null;
      return { trim: t, id: t.id, displayName, extra: extra || null };
    });
  };

  if (!hasLineup) {
    return [{ lineup: null, trims: toGrouped(trims) }];
  }

  const byLineup = new Map<string, T[]>();
  for (const t of trims) {
    const lineup = lineupNameOf(t);
    const list = byLineup.get(lineup);
    if (list) {
      byLineup.set(lineup, [...list, t]);
    } else {
      byLineup.set(lineup, [t]);
    }
  }

  return sortLineups([...byLineup.keys()]).map((lineup) => ({
    lineup,
    trims: toGrouped(byLineup.get(lineup) ?? []),
  }));
}
