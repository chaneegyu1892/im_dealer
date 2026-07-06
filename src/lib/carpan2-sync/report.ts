import type {
  Carpan2SyncPlan,
  InvalidTrimCandidate,
  InvalidVehicleCandidate,
  RatedTrimRisk,
} from "./types";

export type FormatCarpan2SyncPlanInput = {
  readonly sourcePath: string;
  readonly plan: Carpan2SyncPlan;
};

export function formatCarpan2SyncPlan(input: FormatCarpan2SyncPlanInput): string {
  const lines = [
    "카판2 차량 동기화 dry-run",
    `소스 파일: ${input.sourcePath}`,
    "쓰기 작업: 비활성화",
    "",
    "[전체]",
    `DB: 차량 ${input.plan.totals.dbVehicles}, 트림 ${input.plan.totals.dbTrims}`,
    `크롤링: 차량 ${input.plan.totals.crawlVehicles}, 라인업 ${input.plan.totals.crawlLineups}, 트림 ${input.plan.totals.crawlTrims}`,
    `이미지: imageLarge ${input.plan.totals.vehiclesWithImageLarge}, cover ${input.plan.totals.vehiclesWithCover}`,
    `PDF: 카탈로그 ${input.plan.totals.catalogFiles}, 가격표 ${input.plan.totals.priceFiles}`,
    "",
    "[차량]",
    `신규 추가 후보: ${input.plan.vehicleActions.insertNew}`,
    `기존 업데이트 후보: ${input.plan.vehicleActions.updateExisting}`,
    `DB-only 차량 보존: ${input.plan.vehicleActions.preserveDbOnly}`,
    `무효 차량 스킵: ${input.plan.vehicleActions.skipInvalid.length}`,
    ...formatInvalidVehicles(input.plan.vehicleActions.skipInvalid),
    "",
    "[트림]",
    `신규 추가 후보: ${input.plan.trimActions.insertNew}`,
    `기존 업데이트 후보: ${input.plan.trimActions.updateExisting}`,
    `DB-only 트림 보존: ${input.plan.trimActions.preserveDbOnly}`,
    `노출값 변경 위험 후보: ${input.plan.trimActions.rewriteVisibilityCandidates}`,
    `무효 트림 스킵: ${input.plan.trimActions.skipInvalid.length}`,
    ...formatInvalidTrims(input.plan.trimActions.skipInvalid),
    "",
    "[회수율 보호]",
    `회수율 보유 차량: ${input.plan.ratedSafety.ratedVehicles}`,
    `회수율 보유 트림: ${input.plan.ratedSafety.ratedTrims}`,
    `회수율 보유 차량 누락: ${input.plan.ratedSafety.missingRatedVehicles.length}`,
    `회수율 보유 트림 누락: ${input.plan.ratedSafety.missingRatedTrims.length}`,
    `회수율 보유 트림 state 위험: ${input.plan.ratedSafety.stateChangedRatedTrims.length}`,
    `회수율 보유 트림 값 변경 위험: ${input.plan.ratedSafety.valueChangedRatedTrims.length}`,
    ...formatRatedTrimRisks(input.plan.ratedSafety.stateChangedRatedTrims),
  ];

  return `${lines.join("\n")}\n`;
}

function formatInvalidVehicles(candidates: readonly InvalidVehicleCandidate[]): readonly string[] {
  return formatList(candidates, (candidate) => {
    return `  - ${candidate.brand} ${candidate.name} (${candidate.vehicleExternalId}): ${candidate.reason}`;
  });
}

function formatInvalidTrims(candidates: readonly InvalidTrimCandidate[]): readonly string[] {
  return formatList(candidates, (candidate) => {
    return `  - ${candidate.name} (${candidate.trimExternalId}, vehicle ${candidate.vehicleExternalId}): ${candidate.reason}`;
  });
}

function formatRatedTrimRisks(risks: readonly RatedTrimRisk[]): readonly string[] {
  return formatList(risks, (risk) => {
    return `  - vehicle ${risk.vehicleExternalId}, trim ${risk.trimExternalId}: ${risk.dbName}, crawlState=${risk.crawlState ?? "null"}, activeRateSheets=${risk.activeRateSheetCount}`;
  });
}

function formatList<T>(items: readonly T[], formatter: (item: T) => string): readonly string[] {
  const limit = 10;
  const visible = items.slice(0, limit).map(formatter);
  if (items.length <= limit) return visible;
  return [...visible, `  - ...외 ${items.length - limit}건`];
}
