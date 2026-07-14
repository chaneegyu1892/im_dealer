import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AdminUserRecord, AdminUsersStats } from "@/lib/admin-queries";
import UsersClient from "./UsersClient";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

const stats: AdminUsersStats = {
  total: 2,
  active: 2,
  dormant: 0,
  newThisMonth: 0,
  contracts: 0,
  expiringSoon: 0,
};

function user(
  id: string,
  name: string,
  joinedAt: string,
  lastSignInAt: string
): AdminUserRecord {
  return {
    id,
    authUserId: id,
    name,
    phone: "연락처 없음",
    email: `${id}@example.com`,
    avatarUrl: null,
    provider: "kakao",
    source: "member",
    consultationCount: 0,
    contractCount: 0,
    expiringSoonCount: 0,
    joinedAt,
    lastSignInAt,
    firstContactAt: joinedAt,
    lastContactAt: lastSignInAt,
    userStatus: "active",
    role: null,
    activeItems: [],
    contractItems: [],
    internalMemo: null,
  };
}

describe("UsersClient date sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to newest sign-in and switches to newest/oldest signup from the header", () => {
    render(
      <UsersClient
        users={[
          user(
            "recent-login",
            "최근 접속 회원",
            "2026-01-01T00:00:00.000Z",
            "2026-07-14T00:00:00.000Z"
          ),
          user(
            "recent-signup",
            "최근 가입 회원",
            "2026-07-13T00:00:00.000Z",
            "2026-07-01T00:00:00.000Z"
          ),
        ]}
        stats={stats}
      />
    );

    expect(screen.getAllByTestId("user-row")[0]).toHaveTextContent("최근 접속 회원");

    fireEvent.click(screen.getByRole("button", { name: /최초 가입\/접수/ }));
    expect(screen.getAllByTestId("user-row")[0]).toHaveTextContent("최근 가입 회원");

    fireEvent.click(screen.getByRole("button", { name: /최초 가입\/접수/ }));
    expect(screen.getAllByTestId("user-row")[0]).toHaveTextContent("최근 접속 회원");
  });
});
