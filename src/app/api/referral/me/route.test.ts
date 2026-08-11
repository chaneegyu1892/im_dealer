import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REFERRAL_CODE_REGEX } from "@/lib/referral/code";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, update: mocks.update },
    $transaction: mocks.transaction,
  },
}));

// require-user 는 실제 구현을 쓴다 — 401/403 분기가 진짜로 도는지 보기 위해서.
vi.mock("@/lib/admin-auth", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { GET } from "./route";

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    supabaseId: "supabase-1",
    isActive: true,
    referralCode: null,
    ...overrides,
  };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
    meta: { target: ["referralCode"] },
  });
}

/** update 에 넘어간 코드 후보들 (재시도마다 새로 생성되는지 확인용) */
function attemptedCodes(): string[] {
  return mocks.update.mock.calls.map((call) => call[0].data.referralCode as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example");
  mocks.getCurrentUser.mockResolvedValue(member());
  mocks.findUnique.mockResolvedValue({ referralCode: null });
  mocks.update.mockImplementation(async ({ data }: { data: { referralCode: string } }) => ({
    referralCode: data.referralCode,
  }));
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({ user: { findUnique: mocks.findUnique, update: mocks.update } })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/referral/me", () => {
  it("미로그인은 401 이고 DB 를 건드리지 않는다", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("비활성 계정은 403 이고 코드를 만들지 않는다", async () => {
    mocks.getCurrentUser.mockResolvedValue(member({ isActive: false }));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("이미 코드가 있으면 그대로 반환하고 쓰기를 하지 않는다", async () => {
    mocks.getCurrentUser.mockResolvedValue(member({ referralCode: "B7788" }));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      code: "B7788",
      link: "https://imdealer.example/r/B7788",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("코드가 없으면 생성해서 반환한다", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toMatch(REFERRAL_CODE_REGEX);
    expect(body.link).toBe(`https://imdealer.example/r/${body.code}`);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { referralCode: body.code },
      select: { referralCode: true },
    });
  });

  it("두 번 호출해도 같은 코드가 나온다(멱등)", async () => {
    const first = await (await GET()).json();

    // 첫 호출이 코드를 채운 뒤의 상태를 재현한다.
    mocks.getCurrentUser.mockResolvedValue(member({ referralCode: first.code }));
    const second = await (await GET()).json();

    expect(second.code).toBe(first.code);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("코드가 충돌하면 새 트랜잭션에서 새 코드로 재시도한다", async () => {
    mocks.update
      .mockRejectedValueOnce(p2002())
      .mockImplementationOnce(async ({ data }: { data: { referralCode: string } }) => ({
        referralCode: data.referralCode,
      }));

    const response = await GET();
    const body = await response.json();
    const attempts = attemptedCodes();

    expect(response.status).toBe(200);
    expect(body.code).toMatch(REFERRAL_CODE_REGEX);
    expect(attempts).toHaveLength(2);
    // 재시도마다 코드를 새로 뽑는다.
    for (const attempt of attempts) expect(attempt).toMatch(REFERRAL_CODE_REGEX);
    // 반환값은 (실패한 1차가 아니라) 2차 시도의 코드다.
    expect(body.code).toBe(attempts[1]);
    // P2002 는 Postgres 트랜잭션을 abort 시킨다 → 시도마다 트랜잭션이 새로 열려야 한다.
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it("동시 요청이 먼저 코드를 채웠으면 덮어쓰지 않는다", async () => {
    mocks.findUnique.mockResolvedValue({ referralCode: "C4242" });

    const response = await GET();

    expect(await response.json()).toEqual({
      code: "C4242",
      link: "https://imdealer.example/r/C4242",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("5회 연속 충돌하면 500 으로 처리하고 죽지 않는다", async () => {
    mocks.update.mockRejectedValue(p2002());
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "추천인 코드를 준비하지 못했습니다." });
    expect(mocks.update).toHaveBeenCalledTimes(5);
    expect(mocks.transaction).toHaveBeenCalledTimes(5);
    consoleError.mockRestore();
  });

  it("P2002 가 아닌 오류는 재시도하지 않고 500 이다", async () => {
    mocks.update.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(500);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
