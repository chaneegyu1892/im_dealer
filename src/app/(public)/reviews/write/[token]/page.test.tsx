import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findVehicle: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewRequestToken: { findUnique: mocks.findUnique },
    vehicle: { findUnique: mocks.findVehicle },
  },
}));

vi.mock("./ReviewWriteForm", () => ({
  ReviewWriteForm: () => <form aria-label="후기 작성 폼" />,
}));

import ReviewWritePage from "./page";

describe("ReviewWritePage used-token rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findVehicle.mockResolvedValue(null);
  });

  it("renders the already-submitted success screen for a used token instead of an error", async () => {
    mocks.findUnique.mockResolvedValue({
      usedAt: new Date("2026-08-01T00:00:00.000Z"),
      revokedAt: null,
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      savedQuote: null,
    });

    const page = await ReviewWritePage({
      params: Promise.resolve({ token: "used-token" }),
    });
    render(page);

    expect(
      screen.getByText("후기가 접수되었어요")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/담당 어드민 검토 후 공개됩니다/)
    ).toBeInTheDocument();
    expect(screen.queryByText("이미 후기를 남기셨어요")).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "후기 작성 폼" })).not.toBeInTheDocument();
    expect(screen.queryByText("유효하지 않은 링크예요")).not.toBeInTheDocument();
  });

  it("still treats revoked tokens as an invalid-link notice", async () => {
    mocks.findUnique.mockResolvedValue({
      usedAt: null,
      revokedAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      savedQuote: null,
    });

    const page = await ReviewWritePage({
      params: Promise.resolve({ token: "revoked-token" }),
    });
    render(page);

    expect(screen.getByText("사용이 중단된 링크예요")).toBeInTheDocument();
    expect(screen.queryByText("후기가 접수되었어요")).not.toBeInTheDocument();
  });
});
