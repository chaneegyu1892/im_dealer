import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueAlimtalk: vi.fn(),
}));

vi.mock("@/lib/alimtalk/enqueue", () => ({
  enqueueAlimtalk: mocks.enqueueAlimtalk,
}));

import { SIGNUP_COMPLETED_MYPAGE_URL } from "@/lib/alimtalk/templates";
import { sendSignupCompletedAlimtalk } from "./signup-completed-alimtalk";

const target = {
  userId: "user-1",
  name: "홍길동",
  phone: "010-1234-5678",
  referralCode: "K4821",
  signedUpAt: new Date("2026-08-21T05:00:00.000Z"),
} as const;

describe("sendSignupCompletedAlimtalk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enqueueAlimtalk.mockResolvedValue({ ok: true, id: "alim-1" });
  });

  it("SIGNUP_COMPLETED 를 고정 링크 버튼과 함께 적재한다", async () => {
    const result = await sendSignupCompletedAlimtalk(target);

    expect(mocks.enqueueAlimtalk).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueAlimtalk).toHaveBeenCalledWith({
      templateKey: "SIGNUP_COMPLETED",
      phone: "010-1234-5678",
      message: expect.any(String),
      buttons: [
        {
          name: "마이페이지 바로가기",
          type: "WL",
          url_mobile: SIGNUP_COMPLETED_MYPAGE_URL,
          url_pc: SIGNUP_COMPLETED_MYPAGE_URL,
        },
      ],
      userId: "user-1",
      refType: "signup",
      refId: "user-1",
    });
    expect(result).toEqual({ ok: true });
  });

  // 쿠폰 안내를 넣으면 광고성으로 반려되므로 본문에 남지 않았는지 지킨다.
  it("본문에 쿠폰·혜택 문구가 없다", async () => {
    await sendSignupCompletedAlimtalk(target);

    const payload = mocks.enqueueAlimtalk.mock.calls[0]?.[0] as { message: string };
    expect(payload.message).not.toMatch(/쿠폰|할인|혜택|이벤트/);
    expect(payload.message).toContain("K4821");
  });

  it("ALIMTALK_ENABLED 가 꺼져 적재가 disabled 이면 던지지 않는다", async () => {
    mocks.enqueueAlimtalk.mockResolvedValue({ ok: false, reason: "disabled" });

    await expect(sendSignupCompletedAlimtalk(target)).resolves.toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("전화번호가 유효하지 않으면 던진다", async () => {
    mocks.enqueueAlimtalk.mockResolvedValue({ ok: false, reason: "invalid_phone" });

    await expect(sendSignupCompletedAlimtalk({ ...target, phone: null })).rejects.toThrow(
      "invalid_phone",
    );
  });
});
