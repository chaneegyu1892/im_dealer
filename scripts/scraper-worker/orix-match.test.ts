import { describe, it, expect } from 'vitest';
import { matchTrim } from './adapters/orix';

// ORIX CAR_COMBO_3 의 MDEL_NAME2 형태(연식 [YYYY] 포함) 모사
const catalog = [
  { MDEL_NAME2: '스마트스트림 가솔린 3.5 2WD 프리미엄 [2026]', MDEL_PRICE: 43000000 },
  { MDEL_NAME2: '스마트스트림 가솔린 3.5 2WD 프리미엄 [2027]', MDEL_PRICE: 44970000 },
  { MDEL_NAME2: '1.6 프리미엄 [2026]', MDEL_PRICE: 42000000 },
  { MDEL_NAME2: '1.6 프리미엄 [2027]', MDEL_PRICE: 49390000 },
  { MDEL_NAME2: '스마트스트림 가솔린 2.5 프리미엄 [2026]', MDEL_PRICE: 37000000 },
  { MDEL_NAME2: 'LPG 3.5 프리미엄 [2026]', MDEL_PRICE: 38000000 },
];

describe('ORIX matchTrim — 연식·토큰 정교화', () => {
  it('같은 연식을 우선 선택한다 (2026 → [2026], exact)', () => {
    const m = matchTrim('2026년형 가솔린 3.5 2WD 프리미엄', catalog);
    expect(m?.trim.MDEL_NAME2).toBe('스마트스트림 가솔린 3.5 2WD 프리미엄 [2026]');
    expect(m?.confidence).toBe('exact');
  });

  it('1.6 하이브리드 → 같은 연식 1.6 프리미엄 (이전엔 [2027] 49.39M 오매칭)', () => {
    const m = matchTrim('2026년형 가솔린 1.6 하이브리드 프리미엄', catalog);
    expect(m?.trim.MDEL_NAME2).toBe('1.6 프리미엄 [2026]');
    expect(m?.trim.MDEL_PRICE).toBe(42000000); // 타연식 49.39M 아님
  });

  it('ORIX가 구동(2WD) 표기를 생략해도 충돌 아님 → exact', () => {
    const m = matchTrim('2026년형 가솔린 2.5 2WD 프리미엄', catalog);
    expect(m?.trim.MDEL_NAME2).toBe('스마트스트림 가솔린 2.5 프리미엄 [2026]');
    expect(m?.confidence).toBe('exact');
  });

  it('연료 충돌(가솔린↔LPG)은 매칭 제외', () => {
    const m = matchTrim('2026년형 가솔린 3.5 2WD 프리미엄', [
      { MDEL_NAME2: 'LPG 3.5 프리미엄 [2026]', MDEL_PRICE: 38000000 },
    ]);
    expect(m).toBeNull();
  });

  it('같은 연식이 없으면 타연식으로 매칭하되 fuzzy(검토 유도)', () => {
    const m = matchTrim('2026년형 가솔린 3.5 2WD 프리미엄', [
      { MDEL_NAME2: '스마트스트림 가솔린 3.5 2WD 프리미엄 [2027]', MDEL_PRICE: 44970000 },
    ]);
    expect(m?.confidence).toBe('fuzzy');
  });
});
