import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminVehicleDetail, AdminVehicleImage } from "@/types/admin";
import { ImageTab } from "./ImageTab";

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

const vehicle = (): AdminVehicleDetail => ({
  id: "vehicle-1", slug: "sorento", name: "쏘렌토", brand: "기아", category: "SUV",
  vehicleCode: "MQ4", basePrice: 40_000_000, thumbnailUrl: "", imageUrls: [], surchargeRate: 0,
  isVisible: true, isPopular: false, isSpotlight: false, slidingDoorOverride: null,
  advancedSafetyOverride: null, displayOrder: 0, tags: [], description: null,
  createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z",
  thumbnailImageId: null, imageRevision: 0, trims: [], lineups: [], colors: [], images: [
    image(),
    image({ id: "image-trash", title: "삭제됨", origin: "ADMIN", deletedAt: "2026-07-13T00:00:00.000Z" }),
    image({ id: "image-carpan-trash", title: "원본 삭제됨", deletedAt: "2026-07-13T00:00:00.000Z" }),
  ],
});

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

describe("ImageTab destructive mutations", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("deletes, restores, and only exposes permanent purge for ADMIN trash", async () => {
    const trashedMain = image({ deletedAt: "2026-07-13T00:00:00.000Z" });
    const afterTrash = vehicle().images.map((entry) => entry.id === trashedMain.id ? trashedMain : entry);
    const restoredAdmin = image({ id: "image-trash", origin: "ADMIN", title: "삭제됨" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImage(trashedMain, 1) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData(afterTrash, 1) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: mutationImage(restoredAdmin, 2) }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: imageListData(afterTrash.map((entry) => entry.id === restoredAdmin.id ? restoredAdmin : entry), 2) }));
    render(<ImageTab vehicle={vehicle()} canPurgeImages />);

    fireEvent.click(screen.getByRole("button", { name: "전면 이미지 휴지통으로 이동" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ expectedImageRevision: 0 });

    const adminTrash = screen.getByTestId("trash-image-trash");
    expect(within(adminTrash).getByRole("button", { name: "삭제됨 영구 삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "원본 삭제됨 영구 삭제" })).not.toBeInTheDocument();
    fireEvent.click(within(adminTrash).getByRole("button", { name: "삭제됨 복원" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/image-trash/restore");
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({ expectedImageRevision: 1 });
  });

  it("publishes only the authoritative full snapshot after permanent purge", async () => {
    const onVehicleImagesChanged = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {
        storageCleanup: "deleted", imageRevision: 1, vehicleUpdatedAt: "2026-07-13T02:00:00.000Z",
      } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {
        ...imageListData(vehicle().images.filter((entry) => entry.id !== "image-trash"), 1),
        vehicleUpdatedAt: "2026-07-13T02:00:00.000Z",
      } }));
    render(<ImageTab vehicle={vehicle()} canPurgeImages onVehicleImagesChanged={onVehicleImagesChanged} />);

    fireEvent.click(screen.getByRole("button", { name: "삭제됨 영구 삭제" }));

    await waitFor(() => expect(screen.queryByTestId("trash-image-trash")).not.toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ expectedImageRevision: 0 });
    expect(onVehicleImagesChanged).toHaveBeenCalledWith(expect.objectContaining({
      updatedAt: "2026-07-13T02:00:00.000Z", imageRevision: 1,
    }));
  });
});

function mutationImage(entry: AdminVehicleImage, imageRevision: number) {
  return { image: entry, imageRevision, vehicleUpdatedAt: "2026-07-13T01:00:00.000Z" };
}

function imageListData(images: readonly AdminVehicleImage[], imageRevision: number) {
  return {
    images, thumbnailImageId: null, thumbnailUrl: "", imageRevision,
    vehicleUpdatedAt: "2026-07-13T01:00:00.000Z",
  };
}
