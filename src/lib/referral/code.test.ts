import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_PATTERN,
} from "./code";
import { allocateUniqueReferralCode, ensureUserReferralCode } from "./ensure-code";

/** 사양: 대문자 1 + 숫자 4 (예: K4821). 7자리 확장은 롤백됐다. */
const FIVE_CHAR = /^[A-Z][0-9]{4}$/;

describe("referral code 발급", () => {
  it("대문자 1 + 숫자 4 (5자리)로 발급한다", () => {
    const code = generateReferralCode(() => 0);
    expect(code).toBe("A0000");
    expect(code).toHaveLength(5);
    expect(code).toMatch(REFERRAL_CODE_PATTERN);
  });

  it("100회 연속 발급이 모두 5자리 형식을 지킨다", () => {
    for (let i = 0; i < 100; i += 1) {
      const code = generateReferralCode();
      expect(code).toMatch(FIVE_CHAR);
      expect(code).toHaveLength(5);
      expect(REFERRAL_CODE_PATTERN.test(code)).toBe(true);
    }
  });

  it("발급에 Math.random 을 쓰지 않는다 (CSPRNG 유지)", () => {
    const spy = vi.spyOn(Math, "random");
    try {
      for (let i = 0; i < 50; i += 1) generateReferralCode();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("가독성 제외 문자(I/O)는 발급하지 않는다", () => {
    const almostOne = () => 0.999999;
    expect(generateReferralCode(almostOne)).toBe("Z9999");
    for (let i = 0; i < 200; i += 1) {
      expect(generateReferralCode()[0]).not.toBe("I");
      expect(generateReferralCode()[0]).not.toBe("O");
    }
  });
});

describe("referral code 정규화", () => {
  it("소문자·양끝 공백은 살리고 형식 위반은 버린다", () => {
    expect(normalizeReferralCode("k4821")).toBe("K4821");
    expect(normalizeReferralCode(" k4821 ")).toBe("K4821");
    expect(normalizeReferralCode("K4821")).toBe("K4821");
    expect(normalizeReferralCode("4821K")).toBeNull();
    expect(normalizeReferralCode("AB123")).toBeNull();
    expect(normalizeReferralCode("A482")).toBeNull();
    expect(normalizeReferralCode("A48210")).toBeNull();
    expect(normalizeReferralCode("K 4821")).toBeNull();
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });

  it("7자리 레거시 코드는 더 이상 통과시키지 않는다", () => {
    expect(REFERRAL_CODE_PATTERN.test("K482109")).toBe(false);
    expect(normalizeReferralCode("K482109")).toBeNull();
    expect(normalizeReferralCode("k482109")).toBeNull();
    expect(normalizeReferralCode(" k482109 ")).toBeNull();
  });
});

describe("referral code 충돌 재시도", () => {
  it("이미 쓰는 코드면 다음 코드로 재시도해 미사용 코드를 반환한다", async () => {
    let calls = 0;
    const db = {
      user: {
        findUnique: async () => {
          calls += 1;
          return calls <= 2 ? { id: "taken" } : null;
        },
      },
    } as unknown as PrismaClient;

    const code = await allocateUniqueReferralCode(db);
    expect(calls).toBe(3);
    expect(code).toMatch(FIVE_CHAR);
  });

  it("재시도 한도를 넘기면 조용히 중복을 만들지 않고 실패한다", async () => {
    const db = {
      user: { findUnique: async () => ({ id: "taken" }) },
    } as unknown as PrismaClient;

    await expect(allocateUniqueReferralCode(db)).rejects.toThrow(
      "Failed to allocate unique referral code",
    );
  });

  it("update 가 유니크 충돌로 던져도 재시도해 5자리 코드를 저장한다", async () => {
    let attempts = 0;
    const db = {
      user: {
        findUnique: async () => ({ referralCode: null }),
        update: async ({ data }: { data: { referralCode: string } }) => {
          attempts += 1;
          if (attempts === 1) throw new Error("Unique constraint failed");
          return { referralCode: data.referralCode };
        },
      },
    } as unknown as PrismaClient;

    const code = await ensureUserReferralCode("user-1", db);
    expect(attempts).toBe(2);
    expect(code).toMatch(FIVE_CHAR);
  });

  it("기존 코드가 있으면 재발급하지 않는다", async () => {
    const db = {
      user: {
        findUnique: async () => ({ referralCode: "K4821" }),
        update: async () => {
          throw new Error("update 를 호출하면 안 된다");
        },
      },
    } as unknown as PrismaClient;

    await expect(ensureUserReferralCode("user-1", db)).resolves.toBe("K4821");
  });
});
