import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NICE_POPULARITY_COUNT,
  NICE_POPULARITY_FUEL_TYPES,
  type NicePopularityFuelType,
} from "./nice-popularity";
import { STORED_FUEL_POPULARITY_VERSION } from "./fuel-popularity";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recommendationPopularitySnapshot: {
      findFirst: mocks.findFirst,
      upsert: mocks.upsert,
    },
    vehicle: { findMany: mocks.findMany },
  },
}));

import {
  loadCurrentPopularityEvidenceLookup,
  refreshPopularitySnapshotFromNice,
} from "./popularity-runtime";

function rankingHtml(
  fuelType: NicePopularityFuelType,
  options: { count?: number; period?: string } = {}
): string {
  const count = options.count ?? NICE_POPULARITY_COUNT;
  const period = options.period ?? "202606";
  const periodLabel = `${period.slice(0, 4)}년 ${Number(period.slice(4))}월 기준`;
  const rows = Array.from({ length: count }, (_, index) => {
    const rank = index + 1;
    return `
      <tr class="rank-row" data-staym="${period}">
        <td class="cell--model"><div class="cell--rank fc-blue">${rank}</div>
          <span class="model-info"><em class="brand">테스트</em><strong class="name">${fuelType}-${rank}</strong></span>
        </td>
        <td class="cell--sales"><span>${(10_000 - rank).toLocaleString("ko-KR")}대</span></td>
        <td class="cell--share"><span>1.0%</span></td>
        <td class="cell--change up fc-red"><span>+2.5%</span></td>
      </tr>`;
  });
  return `<section><span>${periodLabel}</span><table><tbody>${rows.join("\n")}</tbody></table></section>`;
}

function catalog() {
  return NICE_POPULARITY_FUEL_TYPES.flatMap((fuelType) =>
    Array.from({ length: NICE_POPULARITY_COUNT }, (_, index) => ({
      slug: `${fuelType}-${index + 1}`,
      brand: "테스트",
      name: `${fuelType}-${index + 1}`,
    }))
  );
}

function storedBatch() {
  return {
    version: STORED_FUEL_POPULARITY_VERSION,
    entries: NICE_POPULARITY_FUEL_TYPES.flatMap((fuelType, fuelIndex) =>
      Array.from({ length: NICE_POPULARITY_COUNT }, (_, index) => ({
        fuelType,
        rank: index + 1,
        brand: "테스트",
        model: `${fuelType}-${index + 1}`,
        registrationCount: ((4 - fuelIndex) * 10_000) - index,
        sharePct: 0.01,
        momPct: 0,
        vehicleSlug: `${fuelType}-${index + 1}`,
      }))
    ),
  };
}

function successfulFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const fuelType = url.searchParams.get("filterValue") as NicePopularityFuelType;
    return {
      ok: true,
      status: 200,
      text: async () => rankingHtml(fuelType),
    };
  });
}

describe("NICE 연료별 월간 순위 runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue(catalog());
    mocks.upsert.mockResolvedValue({ id: "snapshot" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("네 연료의 30위 총 120개를 모두 받은 뒤 한 번만 upsert한다", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshPopularitySnapshotFromNice();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([input]) =>
      new URL(String(input)).searchParams.get("filterValue")
    )).toEqual(["gasoline", "diesel", "hybrid", "electric"]);
    expect(result).toMatchObject({
      period: "2026-06",
      mappedEntries: 120,
      mappedEntriesByFuel: {
        gasoline: 30,
        diesel: 30,
        hybrid: 30,
        electric: 30,
      },
      unmatchedEntries: [],
    });
    expect(mocks.upsert).toHaveBeenCalledOnce();

    const stored = mocks.upsert.mock.calls[0]?.[0].create.entries;
    expect(stored.version).toBe(STORED_FUEL_POPULARITY_VERSION);
    expect(stored.entries).toHaveLength(120);
  });

  it("한 연료가 30위까지 온전하지 않으면 기존 월 스냅샷을 건드리지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const fuelType = url.searchParams.get("filterValue") as NicePopularityFuelType;
      return {
        ok: true,
        status: 200,
        text: async () => rankingHtml(fuelType, {
          count: fuelType === "electric" ? 29 : 30,
        }),
      };
    }));

    await expect(refreshPopularitySnapshotFromNice()).rejects.toThrow("30개가 아닙니다");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("연료별 기준월이 섞이면 기존 월 스냅샷을 건드리지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const fuelType = url.searchParams.get("filterValue") as NicePopularityFuelType;
      return {
        ok: true,
        status: 200,
        text: async () => rankingHtml(fuelType, {
          period: fuelType === "diesel" ? "202605" : "202606",
        }),
      };
    }));

    await expect(refreshPopularitySnapshotFromNice()).rejects.toThrow("기준월이 서로 다릅니다");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("최신 월 배치에서 AI 연료 선택에 맞는 순위 lookup을 만든다", async () => {
    mocks.findFirst.mockResolvedValue({ period: "2026-06", entries: storedBatch() });

    const electricLookup = await loadCurrentPopularityEvidenceLookup("전기차");
    expect(electricLookup("electric-1")).toEqual({
      period: "2026-06",
      rank: 1,
      registrationCount: 10_000,
    });
    expect(electricLookup("gasoline-1").rank).toBeNull();

    const allLookup = await loadCurrentPopularityEvidenceLookup("상관없음");
    expect(allLookup("gasoline-1").rank).toBe(1);
    expect(allLookup("electric-30").rank).toBe(120);
  });
});
