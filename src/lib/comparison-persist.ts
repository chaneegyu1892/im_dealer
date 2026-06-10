// 비교 패널(비교 차량 슬롯) 설정을 sessionStorage 에 보관 —
// '이전'으로 조건 설정에 돌아갔다 와도, 새로고침해도 같은 탭 안에서는 비교 설정이 유지된다.
// 기준 차량(slug)별로 키를 분리해 다른 차량 견적에 이전 설정이 새지 않게 한다.

export interface SavedComparison {
  isOpen: boolean;
  p2Slug: string;
  p2TrimId: string | null;
  p2OptionIds: string[];
  p2ExtColor: string | null;
  p2IntColor: string | null;
  p2ProductType: "장기렌트" | "리스";
}

const KEY_PREFIX = "quote-comparison:";

export function comparisonStorageKey(primarySlug: string): string {
  return `${KEY_PREFIX}${primarySlug}`;
}

export function readSavedComparison(primarySlug: string): SavedComparison | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(comparisonStorageKey(primarySlug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as SavedComparison).p2Slug !== "string" ||
      typeof (parsed as SavedComparison).isOpen !== "boolean" ||
      !Array.isArray((parsed as SavedComparison).p2OptionIds) ||
      !["장기렌트", "리스"].includes((parsed as SavedComparison).p2ProductType)
    ) {
      return null;
    }
    return parsed as SavedComparison;
  } catch {
    return null;
  }
}

export function saveComparison(primarySlug: string, state: SavedComparison): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      comparisonStorageKey(primarySlug),
      JSON.stringify(state)
    );
  } catch {
    // 스토리지 제한/프라이빗 모드 등 — 유지 기능만 비활성화되고 비교 자체는 동작해야 한다
  }
}
