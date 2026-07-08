import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorSelector, type VehicleColorPublic } from "./ColorSelector";

const COLORS: VehicleColorPublic[] = [
  {
    id: "exterior-white",
    kind: "EXTERIOR",
    name: "스노우 화이트 펄",
    hexCode: "#f4f1ec",
    imageUrl: null,
    priceDelta: 0,
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: "exterior-gray",
    kind: "EXTERIOR",
    name: "그래비티 그레이",
    hexCode: "#4d5258",
    imageUrl: null,
    priceDelta: 80_000,
    isDefault: false,
    sortOrder: 2,
  },
  {
    id: "interior-black",
    kind: "INTERIOR",
    name: "블랙 원톤",
    hexCode: "#171717",
    imageUrl: null,
    priceDelta: 0,
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: "interior-brown",
    kind: "INTERIOR",
    name: "브라운 투톤",
    hexCode: "#7a4b35",
    imageUrl: null,
    priceDelta: 300_000,
    isDefault: false,
    sortOrder: 2,
  },
];

describe("ColorSelector", () => {
  it("외장과 내장 색상 SelectSheet 트리거를 보여준다", () => {
    const onChange = vi.fn();

    render(
      <ColorSelector
        colors={COLORS}
        exteriorColorId="exterior-white"
        interiorColorId="interior-black"
        onChange={onChange}
      />
    );

    // 트리거 버튼에 선택된 색상 이름 노출
    expect(screen.getByText("스노우 화이트 펄")).toBeInTheDocument();
    expect(screen.getByText("블랙 원톤")).toBeInTheDocument();
    // 보조 라벨
    expect(screen.getByText("외장 색상")).toBeInTheDocument();
    expect(screen.getByText("내장 색상")).toBeInTheDocument();
  });

  it("색상 SelectSheet를 열어 선택하면 기존 kind와 color id 계약으로 알린다", () => {
    const onChange = vi.fn();

    render(
      <ColorSelector
        colors={COLORS}
        exteriorColorId="exterior-white"
        interiorColorId="interior-black"
        onChange={onChange}
      />
    );

    // 외장 — 라벨 버튼을 눌러 시트를 열고 옵션 선택
    const exteriorTrigger = screen.getByText("외장 색상")
      .closest("div")
      ?.querySelector("button");
    fireEvent.click(exteriorTrigger!);
    fireEvent.click(screen.getByText("그래비티 그레이"));

    // 내장 — 라벨 버튼을 눌러 시트를 열고 옵션 선택
    const interiorTrigger = screen.getByText("내장 색상")
      .closest("div")
      ?.querySelector("button");
    fireEvent.click(interiorTrigger!);
    fireEvent.click(screen.getByText("브라운 투톤"));

    expect(onChange).toHaveBeenCalledWith("EXTERIOR", "exterior-gray");
    expect(onChange).toHaveBeenCalledWith("INTERIOR", "interior-brown");
  });
});
