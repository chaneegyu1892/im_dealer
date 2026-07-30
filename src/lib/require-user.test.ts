import { beforeEach, describe, expect, it, vi } from "vitest";
import { type User } from "@prisma/client";
import { getActiveUser, requireActiveUser } from "./require-user";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

const activeUser = {
  id: "member-1",
  supabaseId: "supabase-member-1",
  email: "member@example.com",
  name: "회원",
  role: "member",
  isActive: true,
} as User;

describe("member active-account guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats an inactive local account as signed out for optional member state", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...activeUser, isActive: false });

    await expect(getActiveUser()).resolves.toBeNull();
  });

  it("rejects an inactive local account before protected member work", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...activeUser, isActive: false });

    const { user, error } = await requireActiveUser();

    expect(user).toBeNull();
    expect(error?.status).toBe(403);
    await expect(error?.json()).resolves.toEqual({ error: "비활성화된 계정입니다." });
  });

  it("keeps an active local account available to protected member work", async () => {
    mocks.getCurrentUser.mockResolvedValue(activeUser);

    await expect(requireActiveUser()).resolves.toEqual({ user: activeUser, error: null });
  });
});
