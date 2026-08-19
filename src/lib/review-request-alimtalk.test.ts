import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirstToken: vi.fn(),
  createToken: vi.fn(),
  enqueueAlimtalk: vi.fn(),
  createAlimtalk: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewRequestToken: {
      findFirst: mocks.findFirstToken,
      create: mocks.createToken,
    },
    alimtalkMessage: {
      create: mocks.createAlimtalk,
    },
  },
}));

vi.mock("@/lib/alimtalk/enqueue", () => ({
  enqueueAlimtalk: mocks.enqueueAlimtalk,
}));

import { requestReviewAlimtalkForQuote } from "./review-request-alimtalk";

const quote = {
  id: "quote-1",
  phone: "010-1234-5678",
  customerName: "홍길동",
  userId: "user-1",
} as const;

const issued = {
  id: "token-row-1",
  token: "existing-token",
  url: "https://www.imdealer.co.kr/reviews/write/existing-token",
  expiresAt: new Date("2026-09-18T00:00:00.000Z"),
  reused: true,
};

describe("requestReviewAlimtalkForQuote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.imdealer.co.kr");
    mocks.findFirstToken.mockResolvedValue({
      id: issued.id,
      token: issued.token,
      expiresAt: issued.expiresAt,
    });
    mocks.enqueueAlimtalk.mockResolvedValue({ ok: true, id: "alim-1" });
  });

  it("미사용 토큰이 있으면 create 없이 재사용하고 REVIEW_REQUEST 를 적재한다", async () => {
    const result = await requestReviewAlimtalkForQuote({
      quote,
      actorId: "staff-1",
    });

    expect(mocks.createToken).not.toHaveBeenCalled();
    expect(mocks.enqueueAlimtalk).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueAlimtalk).toHaveBeenCalledWith({
      templateKey: "REVIEW_REQUEST",
      phone: "010-1234-5678",
      message: expect.any(String),
      buttons: [
        {
          name: "후기 작성하기",
          type: "WL",
          url_mobile: issued.url,
          url_pc: issued.url,
        },
      ],
      userId: "user-1",
      refType: "review",
      refId: "quote-1",
    });
    expect(result).toEqual({ ok: true, reused: true });
  });

  it("ALIMTALK_ENABLED 가 꺼져 적재가 disabled 이면 던지지 않는다", async () => {
    mocks.enqueueAlimtalk.mockResolvedValue({ ok: false, reason: "disabled" });

    await expect(
      requestReviewAlimtalkForQuote({ quote, actorId: "staff-1" }),
    ).resolves.toEqual({ ok: false, reason: "disabled", reused: true });
    expect(mocks.createAlimtalk).not.toHaveBeenCalled();
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("enqueue 가 던지면 그대로 전파한다", async () => {
    mocks.enqueueAlimtalk.mockRejectedValue(new Error("alimtalk table unavailable"));

    await expect(
      requestReviewAlimtalkForQuote({ quote, actorId: "staff-1" }),
    ).rejects.toThrow("alimtalk table unavailable");
  });

  it("고객명이 없으면 기본 호칭으로 메시지를 만든다", async () => {
    await requestReviewAlimtalkForQuote({
      quote: { ...quote, customerName: null, userId: null },
      actorId: "staff-1",
    });

    const payload = mocks.enqueueAlimtalk.mock.calls[0]?.[0] as {
      message: string;
      userId: string | undefined;
    };
    expect(payload.message).toContain("고객님");
    expect(payload.userId).toBeUndefined();
  });
});
