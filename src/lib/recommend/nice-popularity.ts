import { z } from "zod";

export const NICE_MODEL_RANKING_URL = "https://www.nicebluemark.co.kr/stat/model";
export const NICE_POPULARITY_COUNT = 30;

const niceModelRankingEntrySchema = z.object({
  rank: z.number().int().min(1).max(NICE_POPULARITY_COUNT),
  brand: z.string().min(1),
  model: z.string().min(1),
  registrationCount: z.number().int().positive(),
  sharePct: z.number().finite().min(0).max(1),
  momPct: z.number().finite(),
}).strict();

export type NiceModelRankingEntry = z.infer<typeof niceModelRankingEntrySchema>;

export interface ParsedNiceModelRanking {
  readonly period: string;
  readonly entries: readonly NiceModelRankingEntry[];
}

export interface PopularityCatalogVehicle {
  readonly slug: string;
  readonly brand: string;
  readonly name: string;
}

export interface ResolvedNiceModelRankingEntry extends NiceModelRankingEntry {
  readonly vehicleSlug: string | null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number(decimal))
    );
}

function textFromCell(row: string, tag: "em" | "strong", className: string): string | null {
  const match = row.match(new RegExp(`<${tag}\\s+class="${className}">\\s*([^<]+?)\\s*</${tag}>`, "i"));
  return match ? decodeHtml(match[1]!.trim()) : null;
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").replace(/[%+]/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

function parseRegistrationCount(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePeriod(value: string): string {
  const match = value.match(/(\d{4})년\s*(\d{1,2})월\s*기준/);
  if (!match) throw new RangeError("NICE 모델 순위 기준월을 찾지 못했습니다.");
  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new RangeError("NICE 모델 순위 기준월이 올바르지 않습니다.");
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * NICE 통계센터의 공개 모델별 순위 HTML에서 상위 30개만 엄격하게 읽는다.
 * DOM 구조가 바뀌거나 순위가 온전하지 않으면 저장하지 않고 실패시킨다.
 */
export function parseNiceModelRankingHtml(html: string): ParsedNiceModelRanking {
  const period = parsePeriod(html);
  const rows = [...html.matchAll(/<tr\s+class="rank-row"[\s\S]*?<\/tr>/gi)];
  if (rows.length !== NICE_POPULARITY_COUNT) {
    throw new RangeError(`NICE 모델 순위 행 수가 ${NICE_POPULARITY_COUNT}개가 아닙니다: ${rows.length}`);
  }

  const entries = rows.map((row) => {
    const value = row[0];
    const rank = Number.parseInt(
      value.match(/<div\s+class="cell--rank[^>]*">\s*(\d+)\s*<\/div>/i)?.[1] ?? "",
      10
    );
    const brand = textFromCell(value, "em", "brand");
    const model = textFromCell(value, "strong", "name");
    const registrationCount = parseRegistrationCount(
      value.match(/class="cell--sales"[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i)?.[1]
    );
    const sharePct = parsePercent(
      value.match(/class="cell--share"[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i)?.[1]
    );
    const momPct = parsePercent(
      value.match(/class="cell--change[^\"]*"[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/i)?.[1]
    );
    const sourcePeriod = value.match(/data-staym="(\d{6})"/i)?.[1];

    if (!Number.isInteger(rank) || !brand || !model || registrationCount === null || sharePct === null || momPct === null) {
      throw new RangeError("NICE 모델 순위 행의 필수 값이 누락되었습니다.");
    }
    if (sourcePeriod !== period.replace("-", "")) {
      throw new RangeError("NICE 모델 순위 행의 기준월이 서로 다릅니다.");
    }
    return niceModelRankingEntrySchema.parse({
      rank,
      brand,
      model,
      registrationCount,
      sharePct,
      momPct,
    });
  });

  const expectedRanks = Array.from({ length: NICE_POPULARITY_COUNT }, (_, index) => index + 1);
  if (entries.map((entry) => entry.rank).join(",") !== expectedRanks.join(",")) {
    throw new RangeError("NICE 모델 순위가 1위부터 30위까지 연속되지 않습니다.");
  }
  return { period, entries };
}

function normalizeBrand(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").trim();
}

/**
 * 브랜드·차량명 표현 차이(공백, 세대 괄호, 하이브리드 표기)를 같은 모델 키로 정규화한다.
 * 매칭이 하나로 확정되지 않으면 절대 임의로 연결하지 않는다.
 */
export function normalizeNiceModelName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/하이브리드/g, "hev")
    .replace(/\bthe\b/g, "")
    .replace(/[\s\-_/\.]/g, "")
    .replace(/[ⅰⅠ]/g, "i")
    .trim();
}

const MODEL_NAME_ALIASES: Readonly<Record<string, string>> = {
  "테슬라|모델y": "newmodely",
  "기아|ev3": "더ev3",
  "기아|ev5": "더ev5",
  "기아|더뉴기아레이": "더뉴레이pe",
  "제네시스|뉴g80": "디올뉴g80fl",
  "bmw|5시리즈": "new5series",
  "벤츠|e클래스": "neweclass",
  "제네시스|뉴gv80": "gv80fl",
  "기아|더뉴니로": "더뉴니로hev",
};

function modelKey(brand: string, model: string): string {
  return `${normalizeBrand(brand)}|${normalizeNiceModelName(model)}`;
}

export function resolveNiceModelRankingEntries(
  entries: readonly NiceModelRankingEntry[],
  catalog: readonly PopularityCatalogVehicle[]
): ResolvedNiceModelRankingEntry[] {
  const catalogByModelKey = new Map<string, PopularityCatalogVehicle[]>();
  for (const vehicle of catalog) {
    const key = modelKey(vehicle.brand, vehicle.name);
    const existing = catalogByModelKey.get(key) ?? [];
    existing.push(vehicle);
    catalogByModelKey.set(key, existing);
  }

  return entries.map((entry) => {
    const sourceKey = modelKey(entry.brand, entry.model);
    const targetModel = MODEL_NAME_ALIASES[sourceKey] ?? normalizeNiceModelName(entry.model);
    const targetKey = `${normalizeBrand(entry.brand)}|${targetModel}`;
    const matches = catalogByModelKey.get(targetKey) ?? [];
    return {
      ...entry,
      vehicleSlug: matches.length === 1 ? matches[0]!.slug : null,
    };
  });
}
