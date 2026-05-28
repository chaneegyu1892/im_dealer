// 차량 옵션 규칙(REQUIRED/INCLUDED/CONFLICT) 적용 로직.
// 서버(견적 API)와 클라이언트(견적 페이지)에서 동일하게 사용한다.

export type OptionRuleType = "REQUIRED" | "INCLUDED" | "CONFLICT";

export interface OptionRule {
  ruleType: string;
  sourceOptionId: string;
  targetOptionId: string;
}

const AUTO_ADD_TYPES = new Set<string>(["REQUIRED", "INCLUDED"]);
// 끌 때 자동으로 따라 해제되는 규칙 — INCLUDED만 번들로 간주.
// REQUIRED는 전제조건 성격이라 사용자가 따로 두고 싶을 수 있어 cascade하지 않는다.
const CASCADE_REMOVE_TYPE = "INCLUDED";

export interface NormalizeResult {
  normalized: Set<string>;
  conflicts: Array<{ sourceOptionId: string; targetOptionId: string }>;
}

// 서버용: 선택된 옵션 집합을 규칙대로 정규화한다.
// - REQUIRED/INCLUDED: 소스가 선택돼 있으면 타겟을 자동 추가 (transitive)
// - CONFLICT: 둘 다 선택된 쌍이 있으면 conflicts 배열에 담아 반환
//   (호출부가 4xx로 거부할지 결정)
export function normalizeSelectedOptions(
  selectedIds: Iterable<string>,
  rules: OptionRule[],
): NormalizeResult {
  const normalized = new Set<string>(selectedIds);

  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      if (!AUTO_ADD_TYPES.has(rule.ruleType)) continue;
      if (!normalized.has(rule.sourceOptionId)) continue;
      if (normalized.has(rule.targetOptionId)) continue;
      normalized.add(rule.targetOptionId);
      changed = true;
    }
  }

  const conflicts: Array<{ sourceOptionId: string; targetOptionId: string }> = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (rule.ruleType !== "CONFLICT") continue;
    if (!normalized.has(rule.sourceOptionId)) continue;
    if (!normalized.has(rule.targetOptionId)) continue;
    const key = [rule.sourceOptionId, rule.targetOptionId].sort().join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    conflicts.push({
      sourceOptionId: rule.sourceOptionId,
      targetOptionId: rule.targetOptionId,
    });
  }

  return { normalized, conflicts };
}

export interface SelectChange {
  next: Set<string>;
  added: string[];
  removed: string[];
}

// 클라이언트용: 옵션을 켤 때.
// 1) 사용자가 클릭한 옵션 추가
// 2) CONFLICT 규칙: 그 옵션과 충돌하는 옵션 제거
// 3) REQUIRED/INCLUDED 규칙: 종속 타겟 transitive 자동 추가
export function applyRulesOnSelect(
  prev: Set<string>,
  optionId: string,
  rules: OptionRule[],
): SelectChange {
  const next = new Set(prev);
  next.add(optionId);
  const removed: string[] = [];
  const added: string[] = [];

  for (const rule of rules) {
    if (rule.ruleType !== "CONFLICT") continue;
    if (rule.sourceOptionId !== optionId) continue;
    if (next.has(rule.targetOptionId)) {
      next.delete(rule.targetOptionId);
      removed.push(rule.targetOptionId);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      if (!AUTO_ADD_TYPES.has(rule.ruleType)) continue;
      if (!next.has(rule.sourceOptionId)) continue;
      if (next.has(rule.targetOptionId)) continue;
      next.add(rule.targetOptionId);
      added.push(rule.targetOptionId);
      changed = true;
    }
  }

  return { next, added, removed };
}

export interface DeselectChange {
  next: Set<string>;
  removed: string[]; // cascade로 같이 해제된 옵션 (사용자가 직접 끈 옵션은 미포함)
}

// 클라이언트용: 옵션을 끌 때.
// - 사용자가 끈 옵션 제거
// - INCLUDED 규칙으로 묶여있던 종속 타겟을 cascade 제거
//   단, 다른 활성 소스가 여전히 그 타겟을 필요로 하면 유지
export function applyRulesOnDeselect(
  prev: Set<string>,
  optionId: string,
  rules: OptionRule[],
): DeselectChange {
  const next = new Set(prev);
  next.delete(optionId);
  const removed: string[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      if (rule.ruleType !== CASCADE_REMOVE_TYPE) continue;
      if (!next.has(rule.targetOptionId)) continue;
      const stillNeeded = rules.some(
        (r) =>
          AUTO_ADD_TYPES.has(r.ruleType) &&
          r.targetOptionId === rule.targetOptionId &&
          next.has(r.sourceOptionId),
      );
      if (stillNeeded) continue;
      next.delete(rule.targetOptionId);
      removed.push(rule.targetOptionId);
      changed = true;
    }
  }

  return { next, removed };
}
