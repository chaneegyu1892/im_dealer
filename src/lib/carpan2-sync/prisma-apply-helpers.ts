import { Prisma } from "@prisma/client";
import type {
  CrawlColorSnapshot,
  CrawlLineupSnapshot,
  CrawlOptionDefinitionSnapshot,
  CrawlTrimOptionSnapshot,
  CrawlTrimSnapshot,
} from "./types";

export type MutableApplyStats = {
  vehiclesUpdated: number;
  newVehiclesSkipped: number;
  invalidVehiclesSkipped: number;
  lineupsUpserted: number;
  trimsUpserted: number;
  invalidTrimsSkipped: number;
  optionsUpserted: number;
  colorsUpserted: number;
};

export function buildLineupMetadata(lineup: CrawlLineupSnapshot): Prisma.InputJsonObject {
  return {
    carpan2: {
      lineupId: lineup.lineupId,
      year: lineup.year,
      state: lineup.state,
    },
  };
}

export function buildTrimSpecs(trim: CrawlTrimSnapshot): Prisma.InputJsonObject {
  return {
    lineup: trim.lineupId,
    displace: trim.displace,
    person: trim.person,
    carry: trim.carry,
  };
}

export function buildTrimDetailedSpecs(trim: CrawlTrimSnapshot): Prisma.InputJsonObject {
  return {
    externalRaw: {
      lineup: trim.lineupId,
      state: trim.state,
      engine: trim.engineCode,
      displace: trim.displace,
      person: trim.person,
      carry: trim.carry,
    },
  };
}

export function buildOptionMetadata(
  option: CrawlTrimOptionSnapshot,
  definition: CrawlOptionDefinitionSnapshot | undefined
): Prisma.InputJsonObject {
  return {
    condition: option.condition,
    flag: option.flag,
    kind: definition?.kind ?? null,
    apply: definition?.apply ?? null,
    guide: definition?.guide ?? null,
    package: definition?.package ?? null,
    change: definition?.change ?? null,
  };
}

export function buildColorMetadata(color: CrawlColorSnapshot): Prisma.InputJsonObject {
  return {
    rgb2: color.rgb2,
    flag: color.flag,
  };
}

export function optionDescription(
  definition: CrawlOptionDefinitionSnapshot | undefined
): string | null {
  if (!definition) return null;
  const parts = [
    definition.apply,
    definition.guide,
    definition.package,
    definition.change,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("\n\n") : null;
}

export function createStats(): MutableApplyStats {
  return {
    vehiclesUpdated: 0,
    newVehiclesSkipped: 0,
    invalidVehiclesSkipped: 0,
    lineupsUpserted: 0,
    trimsUpserted: 0,
    invalidTrimsSkipped: 0,
    optionsUpserted: 0,
    colorsUpserted: 0,
  };
}

export function addStats(target: MutableApplyStats, source: MutableApplyStats): void {
  target.vehiclesUpdated += source.vehiclesUpdated;
  target.newVehiclesSkipped += source.newVehiclesSkipped;
  target.invalidVehiclesSkipped += source.invalidVehiclesSkipped;
  target.lineupsUpserted += source.lineupsUpserted;
  target.trimsUpserted += source.trimsUpserted;
  target.invalidTrimsSkipped += source.invalidTrimsSkipped;
  target.optionsUpserted += source.optionsUpserted;
  target.colorsUpserted += source.colorsUpserted;
}
