import { describe, expect, it } from "vitest";
import {
  NICE_POPULARITY_FUEL_TYPES,
  getNiceModelRankingUrl,
  parseNiceModelRankingHtml,
  resolveNiceModelRankingEntries,
  type NicePopularityFuelType,
  type NiceModelRankingEntry,
} from "./nice-popularity";

function rankingRow(rank: number, overrides: Partial<NiceModelRankingEntry> = {}): string {
  const entry: NiceModelRankingEntry = {
    rank,
    brand: "현대",
    model: `테스트 모델 ${rank}`,
    registrationCount: 10_000 - rank,
    sharePct: 0.01,
    momPct: 0.025,
    ...overrides,
  };
  return `
    <tr class="rank-row" data-staym="202606">
      <td class="cell--model"><div class="cell--rank fc-blue">${entry.rank}</div>
        <span class="model-info"><em class="brand">${entry.brand}</em><strong class="name">${entry.model}</strong></span>
      </td>
      <td class="cell--sales"><span>${entry.registrationCount.toLocaleString("ko-KR")}대</span></td>
      <td class="cell--share"><span>${(entry.sharePct * 100).toFixed(1)}%</span></td>
      <td class="cell--change up fc-red"><span>+${(entry.momPct * 100).toFixed(1)}%</span></td>
    </tr>`;
}

function rankingHtml(rows: readonly string[]): string {
  return `<section><span>2026년 06월 기준</span><table><tbody>${rows.join("\n")}</tbody></table></section>`;
}

describe("NICE 공개 모델 순위 파서", () => {
  it.each(NICE_POPULARITY_FUEL_TYPES)("%s 신차 연료 순위 URL을 만든다", (fuelType) => {
    const url = new URL(getNiceModelRankingUrl(fuelType as NicePopularityFuelType));

    expect(url.origin + url.pathname).toBe("https://www.nicebluemark.co.kr/stat/model");
    expect(url.searchParams.get("filterKind")).toBe("fuelType");
    expect(url.searchParams.get("filterValue")).toBe(fuelType);
    expect(url.searchParams.get("regGb")).toBe("new");
  });

  it("30개 연속 순위와 공개 수치를 안전하게 읽는다", () => {
    const html = rankingHtml(Array.from({ length: 30 }, (_, index) => rankingRow(index + 1, {
      ...(index === 0 ? { brand: "테슬라", model: "모델 Y", registrationCount: 9_188, sharePct: 0.058, momPct: -0.049 } : {}),
    })));

    const parsed = parseNiceModelRankingHtml(html);
    expect(parsed.period).toBe("2026-06");
    expect(parsed.entries).toHaveLength(30);
    expect(parsed.entries[0]).toMatchObject({
      rank: 1,
      brand: "테슬라",
      model: "모델 Y",
      registrationCount: 9_188,
      momPct: -0.049,
    });
    expect(parsed.entries[0]?.sharePct).toBeCloseTo(0.058);
  });

  it("한 행이라도 누락되거나 순위가 끊기면 저장 전에 거부한다", () => {
    const rows = Array.from({ length: 30 }, (_, index) => rankingRow(index + 1));
    rows[29] = rankingRow(1);
    expect(() => parseNiceModelRankingHtml(rankingHtml(rows))).toThrow("연속되지 않습니다");
  });

  it("표기 차이는 매핑하되 내부 카탈로그에 없는 모델은 연결하지 않는다", () => {
    const entries: NiceModelRankingEntry[] = [
      { rank: 1, brand: "테슬라", model: "모델 Y", registrationCount: 9_188, sharePct: 0.058, momPct: 0.049 },
      { rank: 2, brand: "기아", model: "더 뉴쏘렌토 하이브리드(MQ4)", registrationCount: 7_802, sharePct: 0.049, momPct: 0.101 },
      { rank: 3, brand: "BYD", model: "돌핀", registrationCount: 2_000, sharePct: 0.01, momPct: 0 },
    ];
    const resolved = resolveNiceModelRankingEntries(entries, [
      { slug: "tesla-11738", brand: "테슬라", name: "New Model Y" },
      { slug: "kia-11573", brand: "기아", name: "더 뉴 쏘렌토 HEV" },
    ]);

    expect(resolved.map((entry) => entry.vehicleSlug)).toEqual([
      "tesla-11738",
      "kia-11573",
      null,
    ]);
  });

  it("연료별 순위에서 확인된 한글·영문 세대 표기를 명시적 alias로 연결한다", () => {
    const entries: NiceModelRankingEntry[] = [
      { rank: 1, brand: "기아", model: "더 뉴K8 하이브리드", registrationCount: 1_000, sharePct: 0.1, momPct: 0 },
      { rank: 2, brand: "BMW", model: "X3(4세대)", registrationCount: 900, sharePct: 0.09, momPct: 0 },
      { rank: 3, brand: "벤츠", model: "GLC클래스(2세대)", registrationCount: 800, sharePct: 0.08, momPct: 0 },
      { rank: 4, brand: "기아", model: "EV4", registrationCount: 700, sharePct: 0.07, momPct: 0 },
      { rank: 5, brand: "현대", model: "더 뉴스타리아 일렉트릭", registrationCount: 600, sharePct: 0.06, momPct: 0 },
    ];

    const resolved = resolveNiceModelRankingEntries(entries, [
      { slug: "kia-k8-hev", brand: "기아", name: "The New K8 HEV" },
      { slug: "bmw-x3", brand: "BMW", name: "New X3" },
      { slug: "benz-glc", brand: "벤츠", name: "The New GLC-Class" },
      { slug: "kia-ev4", brand: "기아", name: "더 EV4" },
      { slug: "hyundai-staria-ev", brand: "현대", name: "더 뉴 스타리아 EV" },
    ]);

    expect(resolved.map((entry) => entry.vehicleSlug)).toEqual([
      "kia-k8-hev",
      "bmw-x3",
      "benz-glc",
      "kia-ev4",
      "hyundai-staria-ev",
    ]);
  });
});
