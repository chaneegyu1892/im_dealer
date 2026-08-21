import { describe, expect, it } from "vitest";

import { cellConcurrency, mapPool, reqDelay } from "./pace";

describe("mapPool", () => {
  it("동시 실행 수를 제한하고 결과 순서는 입력 순서를 유지한다", async () => {
    let running = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const out = await mapPool(items, 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 10 - (n % 3) * 3)); // 완료 순서를 섞는다
      running--;
      return n * 2;
    });
    expect(out).toEqual(items.map((n) => n * 2));
    expect(peak).toBe(3);
  });

  it("limit 이 1 이면 순차 실행", async () => {
    let peak = 0;
    let running = 0;
    await mapPool([1, 2, 3], 1, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
    });
    expect(peak).toBe(1);
  });

  it("콜백이 던지면 전파된다", async () => {
    await expect(mapPool([1, 2], 2, async (n) => { if (n === 2) throw new Error("boom"); return n; })).rejects.toThrow("boom");
  });
});

describe("속도 설정", () => {
  it("캐피탈사 config 가 기본값보다 우선한다", () => {
    expect(reqDelay({ requestDelayMs: 0 }, 700)).toBe(0);
    expect(cellConcurrency({ cellConcurrency: 1 })).toBe(1);
    const d = reqDelay({ requestDelayMs: 1000 }, 400);
    expect(d).toBeGreaterThanOrEqual(1000);
    expect(d).toBeLessThan(1600); // +0~60% 지터
  });
});
