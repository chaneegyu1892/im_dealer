import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireWorker: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/worker-auth", () => ({
  // 실제 requireWorker 와 동일하게 Bearer 일치 여부만 판정한다.
  requireWorker: mocks.requireWorker,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alimtalkMessage: { updateMany: mocks.updateMany },
  },
}));

import { POST } from "./route";

function resultRequest(results: unknown[], token = "relay-secret") {
  return new NextRequest("http://localhost/api/worker/alimtalk/result", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ results }),
  });
}

describe("POST /api/worker/alimtalk/result", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireWorker.mockImplementation(
      (request: NextRequest) =>
        request.headers.get("authorization") === "Bearer relay-secret"
          ? { error: null }
          : { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    );
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("인증 실패 시 결과를 기록하지 않는다", async () => {
    const response = await POST(resultRequest([], "wrong"));

    expect(response.status).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("정상(ACCEPTED) 세대의 도달 결과를 SENT 로 기록한다", async () => {
    const response = await POST(
      resultRequest([
        { msgIdx: "msg-1", resultCode: "1000", sendType: "K", uid: "biz-1" },
      ])
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "msg-1",
        resultAt: null,
        status: { in: ["SENDING", "ACCEPTED"] },
      },
      data: {
        status: "SENT",
        resultCode: "1000",
        sendType: "K",
        uid: "biz-1",
        failReason: null,
        resultAt: expect.any(Date),
        leaseToken: null,
      },
    });
    await expect(response.json()).resolves.toMatchObject({ ok: true, applied: 1, skipped: 0 });
  });

  it("미도달 결과를 FAILED 로 기록하고 실패 사유를 남긴다", async () => {
    const response = await POST(
      resultRequest([{ msgIdx: "msg-1", resultCode: "3012" }])
    );

    expect(response.status).toBe(200);
    const call = mocks.updateMany.mock.calls[0][0];
    expect(call.data.status).toBe("FAILED");
    expect(call.data.failReason).toContain("3012");
    expect(call.data.failReason).toContain("msgIdx 중복");
  });

  it("유효한 리스가 없는 상태로는 기록하지 않는다(SENDING/ACCEPTED 만 대상)", async () => {
    // PENDING(재클레임 대기)이나 FAILED/SENT(종결) 메시지에 도착한 오래된 세대의
    // 결과가 상태를 덮어쓰는 일(3012 중복 오기록)이 없어야 한다.
    await POST(resultRequest([{ msgIdx: "msg-1", resultCode: "1000" }]));

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "msg-1",
          resultAt: null,
          status: { in: ["SENDING", "ACCEPTED"] },
        }),
      })
    );
  });

  it("이미 종결된 메시지의 결과는 멱등 no-op 로 건너뛴다", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      resultRequest([{ msgIdx: "msg-1", resultCode: "1000" }])
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, applied: 0, skipped: 1 });
  });

  it("배치 일부만 대상이면 나머지는 건너뛰고 전체는 성공한다", async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const response = await POST(
      resultRequest([
        { msgIdx: "msg-1", resultCode: "1000" },
        { msgIdx: "msg-2", resultCode: "3020" },
      ])
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toEqual({ ok: true, applied: 1, skipped: 1 });
  });

  it("DB 오류 시 500 을 반환한다", async () => {
    mocks.updateMany.mockRejectedValue(new Error("db down"));

    const response = await POST(
      resultRequest([{ msgIdx: "msg-1", resultCode: "1000" }])
    );

    expect(response.status).toBe(500);
  });
});
