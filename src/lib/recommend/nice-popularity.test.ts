import { describe, expect, it } from "vitest";
import {
  parseNiceModelRankingHtml,
  resolveNiceModelRankingEntries,
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
});
