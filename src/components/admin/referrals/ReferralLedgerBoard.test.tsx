import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReferralLedgerPage } from "@/lib/admin-queries/referral";

vi.mock("@/components/admin/referrals/ReferralStatusActions", () => ({
  ReferralStatusActions: () => <div data-testid="referral-actions" />,
}));

import { ReferralLedgerBoard } from "./ReferralLedgerBoard";

function page(overrides: Partial<ReferralLedgerPage> = {}): ReferralLedgerPage {
  return {
    items: [
      {
        id: "ref-1",
        code: "AB12CD",
        status: "REWARDED",
        createdAt: "2026-08-01T09:00:00.000Z",
        signupIpHash: "ip-hash-1",
        referrer: { id: "user-a", masked: "re********@example.com" },
        referee: { id: "user-b", masked: "피********" },
      },
      {
        id: "ref-2",
        code: "EF34GH",
        status: "BLOCKED",
        createdAt: "2026-08-02T09:00:00.000Z",
        signupIpHash: null,
        referrer: { id: "user-c", masked: "clxxxus…" },
        referee: { id: "user-d", masked: "clxxxus…" },
      },
      {
        id: "ref-3",
        code: "IJ56KL",
        status: "REVOKED",
        createdAt: "2026-08-03T09:00:00.000Z",
        signupIpHash: null,
        referrer: { id: "user-e", masked: "ch*******@example.com" },
        referee: { id: "user-f", masked: "ka*****" },
      },
    ],
    total: 3,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    statusFilter: "ALL",
    counts: { REWARDED: 1, BLOCKED: 1, REVOKED: 1 },
    ...overrides,
  };
}

describe("ReferralLedgerBoard", () => {
  it("상태별 카운트 카드(인정/차단/철회) 를 렌더한다", () => {
    render(<ReferralLedgerBoard page={page()} />);

    // 카드 라벨은 필터 버튼과 텍스트가 겹치므로 카드 전용 desc 로 검증한다.
    expect(screen.getByText("보상 지급 완료")).toBeInTheDocument();
    expect(screen.getByText("자기 추천 등 어뷰즈")).toBeInTheDocument();
    expect(screen.getByText("보상 철회 완료")).toBeInTheDocument();
    // 카운트 카드 3장 모두 enum 원문을 mono 로 표기한다.
    expect(screen.getAllByText("REWARDED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("BLOCKED").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("REVOKED").length).toBeGreaterThanOrEqual(1);
  });

  it("목록 행마다 코드·상태 뱃지·마스킹 식별자·일시·IP 해시를 렌더한다", () => {
    render(<ReferralLedgerBoard page={page()} />);

    const row1 = screen.getByText("AB12CD").closest("tr");
    expect(row1).not.toBeNull();
    // 상태 뱃지는 행 안에서 상태 원문(enum) 과 함께 표기한다.
    expect(within(row1!).getByText("REWARDED")).toBeInTheDocument();
    expect(within(row1!).getByText("re********@example.com")).toBeInTheDocument();
    expect(within(row1!).getByText("ip-hash-1")).toBeInTheDocument();
    expect(within(row1!).getByText("2026-08-01 09:00")).toBeInTheDocument();

    const row2 = screen.getByText("EF34GH").closest("tr");
    expect(within(row2!).getByText("BLOCKED")).toBeInTheDocument();
  });

  it("빈 목록이면 빈 상태 안내를 렌더한다", () => {
    render(
      <ReferralLedgerBoard
        page={page({ items: [], total: 0, totalPages: 1, counts: { REWARDED: 0, BLOCKED: 0, REVOKED: 0 } })}
      />
    );

    expect(screen.getByText(/추천 인정 기록이 없습니다/)).toBeInTheDocument();
  });

  it("다음 페이지가 있으면 페이지네이션 링크를 노출한다", () => {
    render(
      <ReferralLedgerBoard
        page={page({ page: 2, total: 45, totalPages: 3, statusFilter: "BLOCKED" })}
      />
    );

    const prev = screen.getByRole("link", { name: "이전" });
    const next = screen.getByRole("link", { name: "다음" });
    expect(prev).toHaveAttribute("href", "/admin/referrals?status=BLOCKED&page=1");
    expect(next).toHaveAttribute("href", "/admin/referrals?status=BLOCKED&page=3");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("PII 원본이 렌더 결과에 없다 — 마스킹 식별자만 표기", () => {
    render(<ReferralLedgerBoard page={page()} />);

    expect(screen.getAllByText(/@/).length).toBeGreaterThan(0); // 마스킹된 이메일만
    expect(document.body.innerHTML).not.toContain("user-a");
  });
});
