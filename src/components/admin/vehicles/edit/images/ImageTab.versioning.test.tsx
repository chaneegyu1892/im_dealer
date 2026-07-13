import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminVehicleDetail, AdminVehicleImage } from "@/types/admin";
import { ImageTab } from "./ImageTab";

const image = (overrides: Partial<AdminVehicleImage> = {}): AdminVehicleImage => ({
  id: "image-main", type: "MAIN", origin: "CARPAN2", title: "전면 이미지",
  storageUrl: "/main.webp", sourceUrl: "https://source/main.webp", sourceKey: "main",
  displayOrder: 0, isVisible: true, deletedAt: null,
  createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z",
  isRepresentative: false, ...overrides,
});

const vehicle = (overrides: Partial<AdminVehicleDetail> = {}): AdminVehicleDetail => ({
  id: "vehicle-1", slug: "sorento", name: "쏘렌토", brand: "기아", category: "SUV",
  vehicleCode: "MQ4", basePrice: 40_000_000, thumbnailUrl: "", imageUrls: [], surchargeRate: 0,
  isVisible: true, isPopular: false, isSpotlight: false, slidingDoorOverride: null,
  advancedSafetyOverride: null, displayOrder: 0, tags: [], description: null,
  createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z",
  thumbnailImageId: null, imageRevision: 0, trims: [], lineups: [], colors: [],
  images: [image(), image({ id: "image-cover", type: "COVER", title: "커버", storageUrl: "/cover.webp" })],
  ...overrides,
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("ImageTab version synchronization", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("keeps the authoritative legacy thumbnail and migration lock after reload", async () => {
    const onVehicleImagesChanged = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {
      images: vehicle().images, thumbnailImageId: null, thumbnailUrl: "/legacy.webp",
      imageRevision: 0,
      vehicleUpdatedAt: "2026-07-13T02:00:00.000Z",
    } }));
    render(<ImageTab vehicle={vehicle({ thumbnailUrl: "/legacy.webp" })} onVehicleImagesChanged={onVehicleImagesChanged} />);
    expect(screen.getByText("대표 이미지 연결 대기 중")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /대표로 지정|숨기기|휴지통으로 이동/ }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/vehicles/vehicle-1/images");
    expect(screen.getByText("대표 이미지 연결 대기 중")).toBeInTheDocument();
    expect(onVehicleImagesChanged).toHaveBeenCalledWith(expect.objectContaining({ thumbnailImageId: null, thumbnailUrl: "/legacy.webp" }));
  });

  it("keeps stale sibling B unchanged until reload adopts external A", async () => {
    // Given
    const rowA = image({ id: "image-main", title: "A 이전", sourceKey: "a" });
    const rowB = image({ id: "image-cover", type: "COVER", title: "B 현재", sourceKey: "b" });
    const externalA = { ...rowA, title: "A 외부 변경", updatedAt: "2026-07-13T01:00:00.000Z" };
    const refreshedImages = [externalA, rowB];
    const onVehicleImagesChanged = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "STALE_IMAGE_REVISION", code: "STALE_IMAGE_REVISION" }, 409))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {
        images: refreshedImages, thumbnailImageId: null, thumbnailUrl: "",
        imageRevision: 1,
        vehicleUpdatedAt: "2026-07-13T02:00:00.000Z",
      } }));
    render(<ImageTab vehicle={vehicle({ images: [rowA, rowB] })} onVehicleImagesChanged={onVehicleImagesChanged} />);

    // When
    fireEvent.click(screen.getByRole("button", { name: "B 현재 수정" }));
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "B 오래된 수정" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    // Then
    expect(await screen.findByText("다른 관리자가 이미지 구성을 변경했습니다.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/vehicles/vehicle-1/images/image-cover");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      expectedUpdatedAt: rowB.updatedAt,
      expectedImageRevision: 0,
      title: "B 오래된 수정",
    });
    expect(onVehicleImagesChanged).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "최신 상태 다시 불러오기" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(onVehicleImagesChanged).toHaveBeenCalledWith({
      images: refreshedImages, thumbnailImageId: null, thumbnailUrl: "",
      updatedAt: "2026-07-13T02:00:00.000Z",
      imageRevision: 1,
    });
    expect(screen.getByText("A 외부 변경")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "B 현재" })).toBeInTheDocument();
    expect(screen.queryByText("B 오래된 수정")).not.toBeInTheDocument();
  });

  it("sends the parent revision and publishes only the authoritative full snapshot after a partial mutation", async () => {
    // Given
    const staleA = image({ id: "image-main", title: "A 이전", sourceKey: "a" });
    const rowB = image({ id: "image-cover", type: "COVER", title: "B", sourceKey: "b" });
    const externalA = { ...staleA, title: "A 외부 변경", updatedAt: "2026-07-13T01:00:00.000Z" };
    const hiddenB = { ...rowB, isVisible: false, updatedAt: "2026-07-13T02:00:00.000Z" };
    const onVehicleImagesChanged = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImage(hiddenB, 2) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData([externalA, hiddenB], 2) }));
    render(<ImageTab vehicle={vehicle({ images: [staleA, rowB], imageRevision: 1 })} onVehicleImagesChanged={onVehicleImagesChanged} />);

    // When
    fireEvent.click(screen.getByRole("button", { name: "B 숨기기" }));

    // Then
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      expectedUpdatedAt: rowB.updatedAt,
      expectedImageRevision: 1,
      isVisible: false,
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/vehicles/vehicle-1/images");
    expect(onVehicleImagesChanged).toHaveBeenCalledTimes(1);
    expect(onVehicleImagesChanged).toHaveBeenCalledWith(expect.objectContaining({
      images: [externalA, hiddenB],
      imageRevision: 2,
    }));
  });

  it("retries representative selection with the vehicle version returned by reload", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "STALE_IMAGE_REVISION", code: "STALE_IMAGE_REVISION" }, 409))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {
        images: vehicle().images, thumbnailImageId: null, thumbnailUrl: "",
        imageRevision: 0,
        vehicleUpdatedAt: "2026-07-13T02:00:00.000Z",
      } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {
        thumbnailImageId: "image-cover", thumbnailUrl: "/cover.webp", imageRevision: 1, vehicleUpdatedAt: "2026-07-13T03:00:00.000Z",
      } }));
    render(<ImageTab vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("button", { name: "커버 대표로 지정" }));
    expect(await screen.findByText("다른 관리자가 이미지 구성을 변경했습니다.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "최신 상태 다시 불러오기" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "커버 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      expectedImageRevision: 0,
      expectedVehicleUpdatedAt: "2026-07-13T02:00:00.000Z",
    });
  });

  it("reloads sibling versions after a cross-group edit before the next reorder", async () => {
    const changedAt = "2026-07-13T01:00:00.000Z";
    const updatedSeat = image({ id: "image-seat", type: "SPEC_SEAT", title: "시트", sourceKey: "seat", displayOrder: 0, updatedAt: changedAt });
    const moved = image({ id: "image-cover", title: "시트로 이동", type: "SPEC_SEAT", displayOrder: 1, updatedAt: changedAt });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImage(moved, 1) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData([
        image({ updatedAt: changedAt }), updatedSeat, moved,
      ], 1) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImages([
        { ...moved, displayOrder: 0 }, { ...updatedSeat, displayOrder: 1 },
      ], 2) }));
    render(<ImageTab vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("button", { name: "커버 수정" }));
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "시트로 이동" } });
    fireEvent.change(screen.getByLabelText("이미지 유형"), { target: { value: "SPEC_SEAT" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "시트로 이동 위로 이동" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      items: [
        { id: "image-cover", expectedUpdatedAt: changedAt },
        { id: "image-seat", expectedUpdatedAt: changedAt },
      ],
    });
  });

  it("publishes a live reload after the StrictMode setup-cleanup-setup cycle", async () => {
    const onVehicleImagesChanged = vi.fn();
    const refreshed = vehicle({ updatedAt: "2026-07-13T02:00:00.000Z" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: {
      images: refreshed.images, thumbnailImageId: null, thumbnailUrl: "",
      imageRevision: 1,
      vehicleUpdatedAt: refreshed.updatedAt,
    } }));
    render(<StrictMode><ImageTab vehicle={vehicle()} onVehicleImagesChanged={onVehicleImagesChanged} /></StrictMode>);

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));

    await waitFor(() => expect(onVehicleImagesChanged).toHaveBeenCalledWith(expect.objectContaining({
      updatedAt: refreshed.updatedAt,
      imageRevision: 1,
    })));
    expect(screen.getByRole("button", { name: "새로고침" })).not.toBeDisabled();
  });

  it.each([
    ["same vehicle version remount", vehicle({ updatedAt: "2026-07-13T03:00:00.000Z", images: [image({ title: "동일 차량 최신" })] })],
    ["different vehicle remount", vehicle({ id: "vehicle-2", name: "싼타페", images: [image({ id: "image-santafe", title: "다른 차량 최신" })] })],
  ])("aborts and ignores a pending reload after %s", async (_label, nextVehicle) => {
    let finish: ((response: Response) => void) | undefined;
    let signal: AbortSignal | undefined;
    const onVehicleImagesChanged = vi.fn();
    fetchMock.mockImplementationOnce((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    const rendered = render(<ImageTab key="old" vehicle={vehicle()} onVehicleImagesChanged={onVehicleImagesChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    rendered.rerender(<ImageTab key="new" vehicle={nextVehicle} onVehicleImagesChanged={onVehicleImagesChanged} />);

    expect(signal?.aborted).toBe(true);
    await act(async () => { finish?.(jsonResponse({ success: true, data: {
      images: vehicle().images, thumbnailImageId: null, thumbnailUrl: "", imageRevision: 0, vehicleUpdatedAt: T0,
    } })); });
    expect(onVehicleImagesChanged).not.toHaveBeenCalled();
    expect(screen.getByText(nextVehicle.images[0]?.title ?? "")).toBeInTheDocument();
  });
});

const T0 = "2026-07-12T00:00:00.000Z";

function mutationImage(entry: AdminVehicleImage, imageRevision: number) {
  return { image: entry, imageRevision, vehicleUpdatedAt: "2026-07-13T01:00:00.000Z" };
}

function imageListData(images: AdminVehicleImage[], imageRevision: number) {
  return { images, thumbnailImageId: null, thumbnailUrl: "", imageRevision, vehicleUpdatedAt: "2026-07-13T01:00:00.000Z" };
}

function mutationImages(images: AdminVehicleImage[], imageRevision: number) {
  return { images, imageRevision, vehicleUpdatedAt: "2026-07-13T02:00:00.000Z" };
}
