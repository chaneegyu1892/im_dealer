import { getLineupYear, latestYearLineupNames } from "@/lib/lineup-sort";

interface RecommendationLineupCandidate {
  readonly name: string;
  readonly isVisible?: boolean | null;
}

export interface RecommendationTrimCandidate {
  readonly name: string;
  readonly price: number;
  readonly isDefault: boolean;
  readonly lineup?: RecommendationLineupCandidate | null;
}

export interface RecommendationModelCandidate {
  readonly modelKey: string;
  readonly modelYear: number;
  readonly score: number;
}

export interface RecommendationModelIdentity {
  readonly brand: string;
  readonly name: string;
  readonly defaultTrimName: string;
  readonly lineupName?: string | null;
}

const MODEL_YEAR_TOKEN_RE = /(?:20)?\d{2}년형/g;

function normalizeModelName(name: string): string {
  return name.replace(MODEL_YEAR_TOKEN_RE, "").replace(/\s+/g, " ").trim();
}

export function filterLatestRecommendationTrims<T extends RecommendationTrimCandidate>(
  trims: readonly T[]
): T[] {
  const visibleTrims = trims.filter((trim) => trim.lineup?.isVisible !== false);
  const lineupNames = visibleTrims
    .map((trim) => trim.lineup?.name)
    .filter((name): name is string => Boolean(name));
  const latestLineupNames = latestYearLineupNames(lineupNames);
  const latestLineupTrims = visibleTrims.filter(
    (trim) => !trim.lineup || latestLineupNames.has(trim.lineup.name)
  );
  const trimYears = latestLineupTrims
    .map((trim) => getLineupYear(trim.name))
    .filter((year) => year > 0);

  if (trimYears.length === 0) return latestLineupTrims;

  const latestTrimYear = Math.max(...trimYears);
  return latestLineupTrims.filter((trim) => {
    const year = getLineupYear(trim.name);
    return year === 0 || year === latestTrimYear;
  });
}

export function pickRecommendationTrim<T extends RecommendationTrimCandidate>(
  trims: readonly T[]
): T | undefined {
  const latestTrims = filterLatestRecommendationTrims(trims);
  if (latestTrims.length === 0) return undefined;
  return latestTrims.find((trim) => trim.isDefault)
    ?? [...latestTrims].sort((left, right) => left.price - right.price)[0];
}

export function getRecommendationModelKey(input: RecommendationModelIdentity): string {
  return `${input.brand}:${normalizeModelName(input.name)}`;
}

export function getRecommendationModelYear(input: RecommendationModelIdentity): number {
  return Math.max(
    getLineupYear(input.name),
    getLineupYear(input.defaultTrimName),
    getLineupYear(input.lineupName ?? "")
  );
}

export function latestByRecommendationModel<T extends RecommendationModelCandidate>(
  candidates: readonly T[]
): T[] {
  const latestByModel = new Map<string, T>();
  for (const candidate of candidates) {
    const current = latestByModel.get(candidate.modelKey);
    if (
      !current ||
      candidate.modelYear > current.modelYear ||
      (candidate.modelYear === current.modelYear && candidate.score > current.score)
    ) {
      latestByModel.set(candidate.modelKey, candidate);
    }
  }
  return [...latestByModel.values()];
}
