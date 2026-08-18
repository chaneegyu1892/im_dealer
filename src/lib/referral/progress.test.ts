import { describe, expect, it } from "vitest";
import {
  buildReferralProgressItem,
  computeReferralFunnel,
  formatKstDate,
  maskName,
} from "./progress";

describe("maskName", () => {
  it("masks middle characters", () => {
    expect(maskName("김진규")).toBe("김*규");
    expect(maskName("김규")).toBe("김*");
    expect(maskName("남궁민수")).toBe("남**수");
    expect(maskName("John")).toBe("J**n");
  });

  it("handles empty and single-character names", () => {
    expect(maskName("")).toBe("*");
    expect(maskName("  ")).toBe("*");
    expect(maskName("김")).toBe("김");
  });
});

describe("formatKstDate", () => {
  it("formats in Asia/Seoul regardless of server timezone", () => {
    // UTC 2026-08-17 16:00 = KST 2026-08-18 01:00
    expect(formatKstDate(new Date("2026-08-17T16:00:00Z"))).toBe("2026.08.18");
    expect(formatKstDate(new Date("2026-08-18T14:59:59Z"))).toBe("2026.08.18");
  });
});

describe("buildReferralProgressItem", () => {
  const base = {
    id: "ref-1",
    refereeName: "김진규",
    signedUpAt: new Date("2026-08-10T00:00:00Z"),
  };

  it("stays at step 1 with no quotes", () => {
    const item = buildReferralProgressItem({ ...base, quotes: [] });
    expect(item).toEqual({
      id: "ref-1",
      maskedName: "김*규",
      signedUpLabel: "2026.08.10",
      step: 1,
      isLost: false,
    });
  });

  it("reaches step 2 with a NEW quote", () => {
    const item = buildReferralProgressItem({
      ...base,
      quotes: [{ status: "NEW", contactedAt: null }],
    });
    expect(item.step).toBe(2);
    expect(item.isLost).toBe(false);
  });

  it("reaches step 3 with CONTACTED or IN_PROGRESS quotes", () => {
    for (const status of ["CONTACTED", "IN_PROGRESS"] as const) {
      const item = buildReferralProgressItem({
        ...base,
        quotes: [{ status, contactedAt: new Date() }],
      });
      expect(item.step).toBe(3);
    }
  });

  it("reaches step 4 with a CONVERTED quote", () => {
    const item = buildReferralProgressItem({
      ...base,
      quotes: [
        { status: "LOST", contactedAt: null },
        { status: "CONVERTED", contactedAt: new Date() },
      ],
    });
    expect(item.step).toBe(4);
    expect(item.isLost).toBe(false);
  });

  it("marks isLost when every quote is LOST and none converted", () => {
    const item = buildReferralProgressItem({
      ...base,
      quotes: [{ status: "LOST", contactedAt: new Date() }],
    });
    expect(item.step).toBe(3); // 상담까지 도달한 이력은 유지
    expect(item.isLost).toBe(true);
  });

  it("treats LOST without contactedAt as quote-only step 2", () => {
    const item = buildReferralProgressItem({
      ...base,
      quotes: [{ status: "LOST", contactedAt: null }],
    });
    expect(item.step).toBe(2);
    expect(item.isLost).toBe(true);
  });

  it("uses the furthest quote when multiple exist", () => {
    const item = buildReferralProgressItem({
      ...base,
      quotes: [
        { status: "NEW", contactedAt: null },
        { status: "IN_PROGRESS", contactedAt: new Date() },
      ],
    });
    expect(item.step).toBe(3);
    expect(item.isLost).toBe(false);
  });
});

describe("computeReferralFunnel", () => {
  it("counts referees that ever reached each step, including LOST history", () => {
    const items = [
      { id: "1", maskedName: "가*나", signedUpLabel: "", step: 1 as const, isLost: false },
      { id: "2", maskedName: "나*다", signedUpLabel: "", step: 2 as const, isLost: true },
      { id: "3", maskedName: "다*라", signedUpLabel: "", step: 3 as const, isLost: false },
      { id: "4", maskedName: "라*마", signedUpLabel: "", step: 4 as const, isLost: false },
      { id: "5", maskedName: "마*바", signedUpLabel: "", step: 2 as const, isLost: false },
    ];
    expect(computeReferralFunnel(items)).toEqual({
      signup: 5,
      quote: 4,
      consult: 2,
      contract: 1,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(computeReferralFunnel([])).toEqual({
      signup: 0,
      quote: 0,
      consult: 0,
      contract: 0,
    });
  });
});
