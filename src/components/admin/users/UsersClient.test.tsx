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
  kakaoSynced: 0,
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
    kakaoInfo: null,
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

describe("UsersClient 카카오싱크 수집 정보", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function openDetail(record: AdminUserRecord) {
    render(<UsersClient users={[record]} stats={{ ...stats, total: 1, active: 1 }} />);
    fireEvent.click(screen.getAllByTestId("user-row")[0]);
  }

  it("수집된 회원은 카카오에서 받은 값을 보여준다", () => {
    const record = user("u1", "바오밥오토플랜_오영택", "2026-07-01T00:00:00.000Z", "2026-07-21T00:00:00.000Z");
    openDetail({
      ...record,
      kakaoInfo: {
        // 목록 표시명과 카카오 실명이 다른 실제 사례
        memberName: "오영택",
        memberPhone: "+82 10-7125-5079",
        memberEmail: "bonjil5079@example.com",
        kakaoId: "4896675468",
        kakaoNickname: null,
        channelRelation: "ADDED",
        marketingConsent: true,
        consentedAt: "2026-07-21T02:36:07.563Z",
      },
    });

    expect(screen.getByText("카카오싱크 수집 정보")).toBeInTheDocument();
    expect(screen.getByText("오영택")).toBeInTheDocument();
    expect(screen.getByText("+82 10-7125-5079")).toBeInTheDocument();
    expect(screen.getByText("4896675468")).toBeInTheDocument();
    expect(screen.getByText("추가함")).toBeInTheDocument();
    expect(screen.getByText("동의")).toBeInTheDocument();
    // 미동의 항목(닉네임)은 빈칸이 아니라 "미수집"로 구분해 표시한다
    expect(screen.getByText("미수집")).toBeInTheDocument();
  });

  it("싱크 이전 가입자는 소급 수집 불가를 안내한다", () => {
    const record = user("u2", "기존 회원", "2026-01-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z");
    openDetail({ ...record, kakaoInfo: null });

    expect(screen.getByText("카카오싱크 수집 정보")).toBeInTheDocument();
    expect(screen.getByText(/아직 수집되지 않았습니다/)).toBeInTheDocument();
  });
});
