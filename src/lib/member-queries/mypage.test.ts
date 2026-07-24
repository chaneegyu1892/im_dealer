import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMember: vi.fn(),
  findQuotes: vi.fn(),
  findVehicles: vi.fn(),
  findTrims: vi.fn(),
  findDeliveries: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findMember },
    savedQuote: { findMany: mocks.findQuotes },
    vehicle: { findMany: mocks.findVehicles },
    trim: { findMany: mocks.findTrims },
    quoteDelivery: { findMany: mocks.findDeliveries },
  },
}));

import { getMyPageData } from "./mypage";

describe("getMyPageData", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("현재 회원의 견적만 조회해 진행 중인 견적과 최근 전송 상태를 구성한다", async () => {
    const now = new Date("2026-07-24T03:00:00.000Z");
    mocks.findMember.mockResolvedValue({
      id: "member-1",
      name: "홍길동",
      email: "hong@example.com",
      phone: "010-1234-5678",
      provider: "kakao",
      channelRelation: "ADDED",
      marketingConsent: true,
      consentedAt: now,
    });
    mocks.findQuotes.mockResolvedValue([
      {
        id: "quote-active",
        sessionId: "session-active",
        vehicleId: "vehicle-1",
        trimId: "trim-1",
        contractMonths: 48,
        annualMileage: 20_000,
        depositRate: 10,
        prepayRate: 0,
        contractType: "반납형",
        customerType: "individual",
        monthlyPayment: 560_000,
        pricingStatus: "CALCULATED",
        breakdown: {
          productType: "리스",
          selectedOptions: [{ id: "option-1", name: "드라이브 와이즈" }],
        },
        status: "CONTACTED",
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date("2026-08-07T03:00:00.000Z"),
      },
      {
        id: "quote-converted",
        sessionId: "session-converted",
        vehicleId: "vehicle-2",
        trimId: "trim-2",
        contractMonths: 60,
        annualMileage: 10_000,
        depositRate: 0,
        prepayRate: 0,
        contractType: "반납형",
        customerType: "individual",
        monthlyPayment: 480_000,
        pricingStatus: "CALCULATED",
        breakdown: {},
        status: "CONVERTED",
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date("2026-08-07T03:00:00.000Z"),
      },
    ]);
    mocks.findVehicles.mockResolvedValue([
      { id: "vehicle-1", slug: "sorento", name: "쏘렌토", brand: "기아", thumbnailUrl: "/sorento.png" },
      { id: "vehicle-2", slug: "ev6", name: "EV6", brand: "기아", thumbnailUrl: "/ev6.png" },
    ]);
    mocks.findTrims.mockResolvedValue([
      { id: "trim-1", name: "시그니처" },
      { id: "trim-2", name: "에어" },
    ]);
    mocks.findDeliveries.mockResolvedValue([
      {
        savedQuoteId: "quote-active",
        status: "SENT",
        createdAt: now,
        sentAt: now,
      },
    ]);

    const result = await getMyPageData("supabase-member-1");

    expect(mocks.findQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "supabase-member-1", deletedAt: null },
      })
    );
    expect(result.activeQuote).toMatchObject({
      id: "quote-active",
      sessionId: "session-active",
      vehicleName: "쏘렌토",
      trimName: "시그니처",
      productType: "리스",
      selectedOptionIds: ["option-1"],
      statusInfo: { label: "상담 진행" },
      delivery: { status: "SENT" },
    });
    expect(result.quotes).toHaveLength(2);
  });

  it("회원 행이 없어도 빈 마이페이지를 안전하게 반환한다", async () => {
    mocks.findMember.mockResolvedValue(null);
    mocks.findQuotes.mockResolvedValue([]);
    mocks.findVehicles.mockResolvedValue([]);
    mocks.findTrims.mockResolvedValue([]);

    const result = await getMyPageData("supabase-member-without-profile");

    expect(result).toEqual({
      profile: {
        name: "고객",
        email: null,
        phone: null,
        provider: null,
        channelRelation: null,
        marketingConsent: false,
        consentedAt: null,
      },
      quotes: [],
      activeQuote: null,
    });
    expect(mocks.findDeliveries).not.toHaveBeenCalled();
  });
});
