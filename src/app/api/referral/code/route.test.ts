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

vi.mock("@/lib/admin-auth", () => ({ getCurrentUser: mocks.getCurrentUser }));

import { POST } from "./route";

function member(overrides: Record<string, unknown> = {}) {
  return { id: "user-1", supabaseId: "supabase-1", isActive: true, referralCode: null, ...overrides };
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

describe("POST /api/referral/code", () => {
  it("미로그인은 401 이다", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("코드가 없으면 생성해 code·link 를 반환한다", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toMatch(REFERRAL_CODE_REGEX);
    expect(body.link).toBe(`https://imdealer.example/r/${body.code}`);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("이미 있으면 기존 코드를 재사용한다(멱등)", async () => {
    mocks.getCurrentUser.mockResolvedValue(member({ referralCode: "D5150" }));

    const response = await POST();

    expect(await response.json()).toEqual({
      code: "D5150",
      link: "https://imdealer.example/r/D5150",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
