/**
 * 차량(모델) 단위 수집 필터.
 * 잡 params 의 brands[].modelCds 가 있으면 그 모델만 남긴다 — 브랜드 전량은 수십 분 걸려
 * 한 차량만 다시 볼 때 쓰기 어렵다. 비어있으면 브랜드 전량(기존 동작).
 */
export function pickModels<T>(
  models: T[],
  modelCds: string[] | undefined,
  codeOf: (model: T) => string
): T[] {
  if (!modelCds || modelCds.length === 0) return models;
  const wanted = new Set(modelCds);
  return models.filter((model) => wanted.has(codeOf(model)));
}
