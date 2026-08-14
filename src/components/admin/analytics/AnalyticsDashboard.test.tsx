import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import type { AnalyticsData, DeliveryGateFunnel } from "@/types/admin";

function analyticsData(funnel: DeliveryGateFunnel): AnalyticsData {
  return {
    totalQuoteViews: 0,
    totalVisitors: 0,
    dailyTrend: [],
    vehicleLeaderboard: [],
    engineTypeDistribution: [],
    calcPopularVehicles: [],
    calcConditionDistribution: { months: [], mileages: [], depositPrepayMix: [] },
    topExteriorColors: [],
    topInteriorColors: [],
    deliveryGateFunnel: funnel,
  };
}

describe("AnalyticsDashboard delivery funnel", () => {
  it("splits member calc from the guest login-gate stages", () => {
    render(
      <AnalyticsDashboard
        data={analyticsData({
          memberCalculated: 90,
          guestCalculated: 30,
          gateShown: 18,
          loginClicked: 12,
          converted: 5,
        })}
      />
    );

    expect(screen.getByRole("heading", { name: "회원" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "비회원" })).toBeInTheDocument();
    expect(screen.getByText("견적 산출만 집계")).toBeInTheDocument();
    expect(screen.getByText("산출 → 게이트 → 로그인 → 요청")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("로그인 게이트 표시")).toBeInTheDocument();
    expect(screen.getByText("카카오 로그인 시도")).toBeInTheDocument();
    expect(screen.getByText("견적서 요청 완료")).toBeInTheDocument();
    expect(screen.getByText("게이트 → 로그인 시도율")).toBeInTheDocument();
  });

  it("does not show the guest login rate when no gate was shown", () => {
    render(
      <AnalyticsDashboard
        data={analyticsData({
          memberCalculated: 12,
          guestCalculated: 0,
          gateShown: 0,
          loginClicked: 0,
          converted: 0,
        })}
      />
    );

    expect(screen.getByRole("heading", { name: "회원" })).toBeInTheDocument();
    expect(screen.queryByText("게이트 → 로그인 시도율")).not.toBeInTheDocument();
  });
});
