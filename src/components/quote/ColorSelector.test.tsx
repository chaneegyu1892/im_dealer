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
  it("외장과 내장 색상을 각각 드롭다운으로 보여준다", () => {
    const onChange = vi.fn();

    render(
      <ColorSelector
        colors={COLORS}
        exteriorColorId="exterior-white"
        interiorColorId="interior-black"
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText("외장 색상 선택")).toHaveDisplayValue(
      "스노우 화이트 펄 · 기본"
    );
    expect(screen.getByLabelText("내장 색상 선택")).toHaveDisplayValue("블랙 원톤 · 기본");
    expect(screen.getByRole("option", { name: "그래비티 그레이 · +8만원" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "브라운 투톤 · +30만원" })).toBeInTheDocument();
    expect(screen.getByLabelText("선택된 외장 색상 미리보기: 스노우 화이트 펄")).toBeInTheDocument();
    expect(screen.getByLabelText("선택된 내장 색상 미리보기: 블랙 원톤")).toBeInTheDocument();
  });

  it("색상 드롭다운을 바꾸면 기존 kind와 color id 계약으로 알린다", () => {
    const onChange = vi.fn();

    render(
      <ColorSelector
        colors={COLORS}
        exteriorColorId="exterior-white"
        interiorColorId="interior-black"
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("외장 색상 선택"), {
      target: { value: "exterior-gray" },
    });
    fireEvent.change(screen.getByLabelText("내장 색상 선택"), {
      target: { value: "interior-brown" },
    });

    expect(onChange).toHaveBeenCalledWith("EXTERIOR", "exterior-gray");
    expect(onChange).toHaveBeenCalledWith("INTERIOR", "interior-brown");
  });
});
