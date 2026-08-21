import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BrandBatchCollector from "./BrandBatchCollector";

vi.mock("./ScraperLoginModal", () => ({ default: () => null }));

const VEHICLES = [
  { id: "v1", brand: "기아", name: "쏘렌토" },
  { id: "v2", brand: "기아", name: "스포티지" },
  { id: "v3", brand: "현대", name: "그랜저" },
];

const BASE = {
  financeCompanyId: "fc-1",
  financeCompanyName: "오릭스캐피탈",
  vehicles: VEHICLES,
  productType: "장기렌트",
  onSaved: vi.fn(),
};

afterEach(() => vi.clearAllMocks());

describe("BrandBatchCollector", () => {
  it("기본(브랜드) 모드 — 브랜드를 골라야 수집을 시작할 수 있다", () => {
    render(<BrandBatchCollector {...BASE} />);
    expect(screen.getByText(/브랜드 일괄 수집/)).toBeTruthy();
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByRole("button", { name: /수집 시작/ }).hasAttribute("disabled")).toBe(true);
  });

  it("preset(차량 선택) 모드 — 브랜드 선택 없이 고른 차량 수로 바로 시작한다", () => {
    render(<BrandBatchCollector {...BASE} presetVehicles={[VEHICLES[0], VEHICLES[1], VEHICLES[2]]} />);
    // 브랜드 경계를 넘은 3대(기아 2 + 현대 1)가 그대로 대상이 된다
    expect(screen.getByText(/선택 차량 일괄 수집/)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    const start = screen.getByRole("button", { name: /수집 시작 \(3대\)/ });
    expect(start.hasAttribute("disabled")).toBe(false);
  });

  it("preset 이 빈 배열이면 시작 버튼이 비활성된다", () => {
    render(<BrandBatchCollector {...BASE} presetVehicles={[]} />);
    expect(screen.getByRole("button", { name: /수집 시작/ }).hasAttribute("disabled")).toBe(true);
  });

  it("카탈로그 전용 캐피탈사(신한)는 수집 컨트롤 대신 안내를 띄운다", () => {
    render(<BrandBatchCollector {...BASE} financeCompanyName="신한카드" presetVehicles={[VEHICLES[0]]} />);
    // 트림 지정 수집이 빈 결과만 내므로 시작 자체를 막고 카탈로그 수집 경로를 안내한다
    expect(screen.getByText(/카탈로그 수집 전용/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /수집 시작/ })).toBeNull();
  });
});
