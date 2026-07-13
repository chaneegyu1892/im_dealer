import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminVehicleDetail, AdminVehicleImage } from "@/types/admin";
import { ImageTab } from "./ImageTab";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const image = (overrides: Partial<AdminVehicleImage> = {}): AdminVehicleImage => ({
  id: "image-main",
  type: "MAIN",
  origin: "CARPAN2",
  title: "전면 이미지",
  storageUrl: "/main.webp",
  sourceUrl: "https://source/main.webp",
  sourceKey: "main",
  displayOrder: 0,
  isVisible: true,
  deletedAt: null,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
  isRepresentative: false,
  ...overrides,
});

const vehicle = (overrides: Partial<AdminVehicleDetail> = {}): AdminVehicleDetail => ({
  id: "vehicle-1", slug: "sorento", name: "쏘렌토", brand: "기아", category: "SUV",
  vehicleCode: "MQ4", basePrice: 40_000_000, thumbnailUrl: "", imageUrls: [], surchargeRate: 0,
  isVisible: true, isPopular: false, isSpotlight: false, slidingDoorOverride: null,
  advancedSafetyOverride: null, displayOrder: 0, tags: [], description: null,
  createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z",
  thumbnailImageId: null, imageRevision: 0, trims: [], lineups: [], colors: [], images: [
    image(),
    image({ id: "image-cover", type: "COVER", title: "커버", displayOrder: 1 }),
    image({ id: "image-seat", type: "SPEC_SEAT", title: "시트", sourceKey: "seat" }),
    image({ id: "image-trash", type: "MAIN", title: "삭제됨", origin: "ADMIN", deletedAt: "2026-07-13T00:00:00.000Z" }),
    image({ id: "image-carpan-trash", type: "MAIN", title: "원본 삭제됨", deletedAt: "2026-07-13T00:00:00.000Z" }),
  ],
  ...overrides,
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("ImageTab", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders every canonical group and separates trash", () => {
    render(<ImageTab vehicle={vehicle()} canPurgeImages />);
    expect(screen.getByText("이미지 노출·순서·대표·휴지통 관리")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "대표 및 주요 이미지" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "시트 상세" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "카탈로그 페이지" })).toBeInTheDocument();
    expect(screen.getByText("2개 · 드래그/이동 버튼으로 정렬")).toHaveClass("text-[#6B7399]");
    expect(screen.getByText("복원 시 기존 노출 상태를 유지합니다. 관리자 등록 이미지만 영구 삭제할 수 있습니다.")).toHaveClass("text-[#6B7399]");
    expect(within(screen.getByTestId("image-trash")).getByText("삭제됨")).toBeInTheDocument();
  });

  it("does not expose an actionable purge control to staff for ADMIN-origin trash", () => {
    render(<ImageTab vehicle={vehicle()} canPurgeImages={false} />);

    const adminTrash = screen.getByTestId("trash-image-trash");
    expect(within(adminTrash).queryByRole("button", { name: "삭제됨 영구 삭제" })).not.toBeInTheDocument();
    expect(within(adminTrash).getByText("관리자 권한 필요")).toBeInTheDocument();
  });

  it("sends the complete active group set for keyboard reorder", async () => {
    const reordered = [
      image({ id: "image-cover", type: "COVER", title: "커버", displayOrder: 0 }),
      image({ displayOrder: 1 }),
    ];
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImages(reordered) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData([
        ...reordered,
        ...vehicle().images.filter((entry) => entry.type !== "MAIN" && entry.type !== "COVER"),
      ], 1) }));
    render(<ImageTab vehicle={vehicle()} canPurgeImages />);
    fireEvent.click(screen.getByRole("button", { name: "커버 위로 이동" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/vehicles/vehicle-1/images/reorder");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      group: "PRIMARY",
      expectedImageRevision: 0,
      items: [
        { id: "image-cover", expectedUpdatedAt: "2026-07-12T00:00:00.000Z" },
        { id: "image-main", expectedUpdatedAt: "2026-07-12T00:00:00.000Z" },
      ],
    });
  });

  it("selects a representative and disables its hide and delete controls", async () => {
    const representativeImages = vehicle().images.map((entry) => ({ ...entry, isRepresentative: entry.id === "image-main" }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {
        thumbnailImageId: "image-main", thumbnailUrl: "/main.webp", imageRevision: 1, vehicleUpdatedAt: "2026-07-13T01:00:00.000Z",
      } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData(representativeImages, 1, "image-main", "/main.webp") }));
    render(<ImageTab vehicle={vehicle()} canPurgeImages />);
    fireEvent.click(screen.getByRole("button", { name: "전면 이미지 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/image-main/representative");
    expect(screen.getByText("대표 이미지")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전면 이미지 숨기기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "전면 이미지 휴지통으로 이동" })).toBeDisabled();
    const explanation = screen.getByText("대표 이미지를 변경한 뒤 숨기거나 삭제할 수 있습니다.");
    expect(explanation).toBeVisible();
    expect(screen.getByRole("button", { name: "전면 이미지 숨기기" })).toHaveAttribute("aria-describedby", explanation.id);
  });

  it("preserves an unknown backend error message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "이 차량을 수정할 권한이 없습니다.", code: "VEHICLE_SCOPE_FORBIDDEN" }, 403));
    render(<ImageTab vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("button", { name: "전면 이미지 숨기기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이 차량을 수정할 권한이 없습니다.");
  });

  it("ignores an incomplete reorder response and commits the authoritative reload", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImages([image()]) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData(vehicle().images, 1) }));
    render(<ImageTab vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("button", { name: "커버 위로 이동" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/vehicles/vehicle-1/images");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders empty and broken-image states without losing accessible names", () => {
    const broken = vehicle({ images: [image({ storageUrl: "/broken.webp" })] });
    render(<ImageTab vehicle={broken} />);
    fireEvent.error(screen.getByRole("img", { name: "전면 이미지 미리보기" }));
    expect(screen.getByRole("img", { name: "전면 이미지 이미지를 불러올 수 없음" })).toHaveClass("text-[#4A5270]");
    expect(within(screen.getByRole("region", { name: "외장 색상" })).getByText("등록된 이미지가 없습니다")).toBeInTheDocument();
  });

  it("shows a contextual server error for 500 responses", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "차량 이미지 처리 중 오류가 발생했습니다." }, 500));
    render(<ImageTab vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("button", { name: "전면 이미지 숨기기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("차량 이미지 처리 중 오류가 발생했습니다.");
  });

  it("blocks duplicate same-tick mutations and exposes loading state", async () => {
    let finish: ((response: Response) => void) | undefined;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData(vehicle().images.map((entry) => entry.id === "image-main" ? image({ isVisible: false }) : entry), 1) }));
    render(<ImageTab vehicle={vehicle()} />);
    const hide = screen.getByRole("button", { name: "전면 이미지 숨기기" });
    fireEvent.click(hide);
    fireEvent.click(hide);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "처리 중..." })).toBeDisabled();
    finish?.(jsonResponse({ success: true, data: mutationImage(image({ isVisible: false })) }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "새로고침" })).toBeEnabled());
  });

  it("sends drag reorder through the same complete-group contract", async () => {
    const reordered = [image({ id: "image-cover", type: "COVER", title: "커버" }), image({ displayOrder: 1 }), image({ id: "image-conflict", displayOrder: 2 })];
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImages(reordered) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData(reordered, 1) }));
    const transfer = { value: "", setData: vi.fn((_type: string, value: string) => { transfer.value = value; }), getData: vi.fn(() => transfer.value) };
    render(<ImageTab vehicle={vehicle({ images: [...vehicle().images, image({ id: "image-conflict", title: "충돌", displayOrder: 2 })] })} />);
    fireEvent.dragStart(screen.getByTestId("image-card-image-cover"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("image-card-image-main"), { dataTransfer: transfer });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).items.map((item: { id: string }) => item.id)).toEqual(["image-cover", "image-main", "image-conflict"]);
  });

  it("reloads the complete authoritative list after a same-group edit", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImage(image({ title: "전면 수정" })) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData(vehicle().images.map((entry) => entry.id === "image-main" ? image({ title: "전면 수정" }) : entry), 1) }));
    render(<ImageTab vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("button", { name: "전면 이미지 수정" }));
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "전면 수정" } });
    fireEvent.submit(screen.getByRole("button", { name: "변경사항 저장" }).closest("form") ?? document.body);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/image-main");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/vehicles/vehicle-1/images");
    expect(screen.getByRole("button", { name: "전면 수정 수정" })).toBeInTheDocument();
  });

  it("shows network failures inline", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<ImageTab vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("button", { name: "전면 이미지 숨기기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
  });

  it("shows a broken-image fallback in trash", () => {
    render(<ImageTab vehicle={vehicle({ images: [image({ id: "trash-broken", title: "휴지통 오류", deletedAt: "2026-07-13T00:00:00.000Z", storageUrl: "/broken.webp" })] })} />);
    fireEvent.error(screen.getByRole("img", { name: "휴지통 오류 휴지통 미리보기" }));
    expect(screen.getByRole("img", { name: "휴지통 오류 이미지를 불러올 수 없음" })).toHaveClass("text-[#4A5270]");
  });

  it("waits for the authoritative post-upload reload before closing and restoring opener focus", async () => {
    let finishReload: ((response: Response) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImage(image({ id: "image-upload", title: "업로드 이미지", origin: "ADMIN" })) }, 201))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishReload = resolve; }));
    render(<ImageTab vehicle={vehicle()} />);
    const opener = screen.getAllByRole("button", { name: "이미지 추가" })[0];
    if (!opener) throw new Error("missing image add opener");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText("이미지 파일"), { target: { files: [new File(["image"], "upload.png", { type: "image/png" })] } });
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "업로드 이미지" } });
    fireEvent.submit(screen.getByRole("button", { name: "이미지 업로드" }).closest("form") ?? document.body);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("dialog", { name: "이미지 추가" })).toBeInTheDocument();
    finishReload?.(jsonResponse({ success: true, data: imageListData([
      ...vehicle().images,
      image({ id: "image-upload", title: "업로드 이미지", origin: "ADMIN" }),
    ], 1) }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "이미지 추가" })).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});

function mutationImage(entry: AdminVehicleImage) {
  return { image: entry, imageRevision: 1, vehicleUpdatedAt: "2026-07-13T01:00:00.000Z" };
}

function imageListData(
  images: AdminVehicleImage[],
  imageRevision: number,
  thumbnailImageId: string | null = null,
  thumbnailUrl = "",
) {
  return {
    images,
    thumbnailImageId,
    thumbnailUrl,
    imageRevision,
    vehicleUpdatedAt: "2026-07-13T01:00:00.000Z",
  };
}

function mutationImages(images: AdminVehicleImage[]) {
  return { images, imageRevision: 1, vehicleUpdatedAt: "2026-07-13T01:00:00.000Z" };
}
