import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

import { getCurrentUser, SessionLookupError } from "./admin-auth";

const localUser = {
  id: "member-1",
  supabaseId: "supabase-member-1",
  email: "member@example.com",
  name: "회원",
  role: "member",
  isActive: true,
} as User;

function sessionError(name: string, status?: number, extras: Record<string, unknown> = {}) {
  return Object.assign(new Error(name), { name, status, ...extras });
}

describe("getCurrentUser", () => {
  const previousE2EDriver = process.env.VEHICLE_IMAGE_STORAGE_DRIVER;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VEHICLE_IMAGE_STORAGE_DRIVER;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousE2EDriver === undefined) {
      delete process.env.VEHICLE_IMAGE_STORAGE_DRIVER;
    } else {
      process.env.VEHICLE_IMAGE_STORAGE_DRIVER = previousE2EDriver;
    }
  });

  it("returns the local user for a valid Supabase session", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "supabase-member-1" } },
      error: null,
    });
    mocks.findUnique.mockResolvedValue(localUser);

    await expect(getCurrentUser()).resolves.toEqual(localUser);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { supabaseId: "supabase-member-1" },
    });
  });

  it("does not treat a thrown network/500 session failure as a guest", async () => {
    mocks.getUser.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), { status: 500 })
    );

    await expect(getCurrentUser()).rejects.toBeInstanceOf(SessionLookupError);
    await expect(getCurrentUser()).rejects.toMatchObject({
      name: "SessionLookupError",
      retryable: true,
    });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("does not treat a 500-class getUser error payload as a guest", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: sessionError("AuthApiError", 500, { message: "Internal Server Error" }),
    });

    await expect(getCurrentUser()).rejects.toBeInstanceOf(SessionLookupError);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a clearly unauthenticated session", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: sessionError("AuthSessionMissingError", 400, {
        message: "Auth session missing!",
      }),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when getUser reports no user and no error", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("treats an expired or invalid token as a guest, not a retryable outage", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: sessionError("AuthApiError", 401, { code: "bad_jwt", message: "invalid JWT" }),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found"],
    ["refresh_token_already_used", "Invalid Refresh Token: Already Used"],
  ] as const)("treats AuthApiError(400, %s) as a guest, not a retryable outage", async (code, message) => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: sessionError("AuthApiError", 400, { code, message }),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("does not treat a malformed session error object as a guest", async () => {
    mocks.getUser.mockRejectedValue({ foo: "not-an-error", statusText: "whoops" });

    await expect(getCurrentUser()).rejects.toBeInstanceOf(SessionLookupError);
  });
});
