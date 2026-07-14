import type { Prisma } from "@prisma/client";
import { latestYearLineupNames } from "@/lib/lineup-sort";
import { isCurrentlySold } from "@/lib/vehicle-import-mappings";

/**
 * 고객에게 노출 가능한 트림의 DB 조건.
 *
 * - Trim.isVisible: Carpan2 판매 상태(state=2) 또는 수동 트림의 운영 상태
 * - VehicleLineup.isVisible: 운영자가 승인한 연식/라인업
 * - lineupId=null: 어드민에서 직접 만든 라인업 없는 트림의 레거시 호환
 *
 * Vehicle.isVisible은 차량 조회 경계에서 별도로 검사한다.
 */
export const PUBLIC_TRIM_WHERE = {
  isVisible: true,
  OR: [
    { lineupId: null },
    { lineup: { is: { isVisible: true } } },
  ],
} satisfies Prisma.TrimWhereInput;

export interface PublicTrimVisibilityCandidate {
  readonly isVisible: boolean;
  readonly lineup?: {
    readonly name: string;
    readonly isVisible: boolean;
  } | null;
}

/** 고객 선택 화면에서는 공개 라인업 중 같은 차량군의 최신 연식만 남긴다. */
export function filterLatestPublicTrims<T extends PublicTrimVisibilityCandidate>(
  trims: readonly T[],
): T[] {
  const visibleTrims = trims.filter(
    (trim) => trim.isVisible && trim.lineup?.isVisible !== false,
  );
  const latestNames = latestYearLineupNames(
    visibleTrims
      .map((trim) => trim.lineup?.name)
      .filter((name): name is string => Boolean(name)),
  );

  return visibleTrims.filter(
    (trim) => !trim.lineup || latestNames.has(trim.lineup.name),
  );
}

/** Carpan2 상세 JSON에서 판매 상태 코드를 안전하게 읽는다. */
export function getCarpan2TrimState(detailedSpecs: unknown): string | null {
  if (!isRecord(detailedSpecs)) return null;
  const externalRaw = detailedSpecs.externalRaw;
  if (!isRecord(externalRaw)) return null;
  return typeof externalRaw.state === "string" ? externalRaw.state : null;
}

export function isCarpan2TrimCurrentlySold(detailedSpecs: unknown): boolean | null {
  const state = getCarpan2TrimState(detailedSpecs);
  return state === null ? null : isCurrentlySold(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
