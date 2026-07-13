import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminVehicleDetail, AdminVehicleImage } from "@/types/admin";
import { VehicleEditor } from "./VehicleEditor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const T0 = "2026-07-12T00:00:00.000Z";
const T1 = "2026-07-13T01:00:00.000Z";
const T2 = "2026-07-13T02:00:00.000Z";
const T3 = "2026-07-13T03:00:00.000Z";

function image(id: string, title: string, updatedAt = T0, representative = false): AdminVehicleImage {
  return {
    id, type: "COVER", origin: "CARPAN2", title, storageUrl: `/${id}.webp`, sourceUrl: null,
    sourceKey: id, displayOrder: 0, isVisible: true, deletedAt: null, createdAt: T0, updatedAt,
    isRepresentative: representative,
  };
}

function vehicle(overrides: Partial<AdminVehicleDetail> = {}): AdminVehicleDetail {
  const cover = image("cover-old", "기존 표지", T0, true);
  return {
    id: "vehicle-1", slug: "sorento", name: "쏘렌토", brand: "기아", category: "SUV",
    vehicleCode: "MQ4", basePrice: 40_000_000, thumbnailUrl: cover.storageUrl, imageUrls: [],
    surchargeRate: 0, isVisible: true, isPopular: false, isSpotlight: false,
    slidingDoorOverride: null, advancedSafetyOverride: null, displayOrder: 0, tags: [],
    description: null, createdAt: T0, updatedAt: T0, thumbnailImageId: cover.id, imageRevision: 0,
    images: [cover], trims: [], lineups: [], colors: [], ...overrides,
  };
}

function success(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ success: true, data: {
    imageRevision: 1,
    ...data,
  } }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

function existingCover(): AdminVehicleImage {
  const cover = vehicle().images[0];
  if (!cover) throw new Error("vehicle fixture cover is missing");
  return cover;
}

describe("VehicleEditor authoritative image snapshots", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("atomically adopts a newer external representative and complete image set", () => {
    const external = image("cover-external", "외부 대표", T2, true);
    const rendered = render(<StrictMode><VehicleEditor vehicle={vehicle()} /></StrictMode>);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));

    rendered.rerender(<StrictMode><VehicleEditor vehicle={vehicle({
      imageRevision: 1, updatedAt: T2, thumbnailImageId: external.id, thumbnailUrl: external.storageUrl, images: [external],
    })} /></StrictMode>);

    expect(screen.queryByText("기존 표지")).not.toBeInTheDocument();
    expect(screen.getByText("외부 대표")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "기본정보" }));
    expect(screen.getByRole("img", { name: "쏘렌토 대표 이미지" })).toHaveAttribute("src", external.storageUrl);
  });

  it("adopts an image-only external payload when imageRevision advances", () => {
    const updated = { ...image("cover-old", "외부 이미지 수정", T2, true), isVisible: false };
    const rendered = render(<VehicleEditor vehicle={vehicle()} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));

    rendered.rerender(<VehicleEditor vehicle={vehicle({ imageRevision: 1, images: [updated] })} />);

    expect(screen.queryByText("기존 표지")).not.toBeInTheDocument();
    expect(screen.getByText("외부 이미지 수정")).toBeInTheDocument();
  });

  it("atomically adopts a newer external purge when the removed image had the newest image timestamp", () => {
    const retained = image("cover-retained", "유지된 표지", T0, true);
    const purged = image("cover-purged", "삭제될 이미지", T2);
    const rendered = render(<VehicleEditor vehicle={vehicle({
      imageRevision: 2, updatedAt: T2, images: [retained, purged], thumbnailImageId: retained.id,
      thumbnailUrl: retained.storageUrl,
    })} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));

    rendered.rerender(<VehicleEditor vehicle={vehicle({
      imageRevision: 3, updatedAt: T3, images: [retained], thumbnailImageId: retained.id,
      thumbnailUrl: retained.storageUrl,
    })} />);

    expect(screen.getByText("유지된 표지")).toBeInTheDocument();
    expect(screen.queryByText("삭제될 이미지")).not.toBeInTheDocument();
  });

  it("does not let an unchanged older prop overwrite a newer local representative", async () => {
    const old = image("cover-old", "기존 표지", T0, true);
    const next = image("cover-next", "로컬 대표", T0, false);
    fetchMock
      .mockResolvedValueOnce(success({
        thumbnailImageId: next.id, thumbnailUrl: next.storageUrl, imageRevision: 1, vehicleUpdatedAt: T2,
      }))
      .mockResolvedValueOnce(success({
        images: [
          { ...old, isRepresentative: false },
          { ...next, isRepresentative: true },
        ],
        thumbnailImageId: next.id, thumbnailUrl: next.storageUrl, imageRevision: 1, vehicleUpdatedAt: T2,
      }));
    const initial = vehicle({ images: [old, next] });
    const rendered = render(<VehicleEditor vehicle={initial} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "로컬 대표 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    rendered.rerender(<VehicleEditor vehicle={initial} />);
    fireEvent.click(screen.getByRole("tab", { name: "기본정보" }));
    expect(screen.getByRole("img", { name: "쏘렌토 대표 이미지" })).toHaveAttribute("src", next.storageUrl);
  });

  it("does not let a delayed t1 RSC payload overwrite a locally accepted t2 snapshot", async () => {
    const next = image("cover-next", "로컬 t2 대표", T0, false);
    const delayed = image("cover-delayed", "지연된 t1 대표", T1, true);
    fetchMock
      .mockResolvedValueOnce(success({
        thumbnailImageId: next.id, thumbnailUrl: next.storageUrl, imageRevision: 2, vehicleUpdatedAt: T2,
      }))
      .mockResolvedValueOnce(success({
        images: [{ ...next, isRepresentative: true }],
        thumbnailImageId: next.id, thumbnailUrl: next.storageUrl, imageRevision: 2, vehicleUpdatedAt: T2,
      }));
    const rendered = render(<VehicleEditor vehicle={vehicle({ images: [existingCover(), next] })} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "로컬 t2 대표 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    rendered.rerender(<VehicleEditor vehicle={vehicle({
      imageRevision: 1, updatedAt: T1, images: [delayed], thumbnailImageId: delayed.id,
      thumbnailUrl: delayed.storageUrl,
    })} />);

    expect(screen.getByText("로컬 t2 대표")).toBeInTheDocument();
    expect(screen.queryByText("지연된 t1 대표")).not.toBeInTheDocument();
  });

  it("keeps a newer equal-revision vehicle CAS after reload and image-tab remount", async () => {
    const next = image("cover-next", "다시 지정할 표지", T0, false);
    const initial = vehicle({ images: [existingCover(), next] });
    fetchMock
      .mockResolvedValueOnce(successError("STALE_VEHICLE_STATE", 409))
      .mockResolvedValueOnce(success({
        images: initial.images,
        thumbnailImageId: initial.thumbnailImageId,
        thumbnailUrl: initial.thumbnailUrl,
        imageRevision: 0,
        vehicleUpdatedAt: T2,
      }))
      .mockResolvedValueOnce(success({
        thumbnailImageId: next.id,
        thumbnailUrl: next.storageUrl,
        imageRevision: 1,
        vehicleUpdatedAt: T3,
      }));
    const rendered = render(<StrictMode><VehicleEditor vehicle={initial} /></StrictMode>);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "다시 지정할 표지 대표로 지정" }));
    fireEvent.click(await screen.findByRole("button", { name: "최신 상태 다시 불러오기" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("tab", { name: "기본정보" }));
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "다시 지정할 표지 대표로 지정" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      expectedImageRevision: 0,
      expectedVehicleUpdatedAt: T2,
    });
    rendered.unmount();
  });

  it("ignores a pending old-version response after a same-vehicle authoritative remount", async () => {
    let finish: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const next = image("cover-next", "대기 중 로컬 대표", T0, false);
    const external = image("cover-external", "최신 외부 대표", T3, true);
    const rendered = render(<VehicleEditor vehicle={vehicle({ images: [existingCover(), next] })} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "대기 중 로컬 대표 대표로 지정" }));
    rendered.rerender(<VehicleEditor vehicle={vehicle({
      imageRevision: 3, updatedAt: T3, images: [external], thumbnailImageId: external.id, thumbnailUrl: external.storageUrl,
    })} />);

    await act(async () => { finish?.(success({ thumbnailImageId: next.id, thumbnailUrl: next.storageUrl, imageRevision: 1, vehicleUpdatedAt: T1 })); });
    expect(screen.getByText("최신 외부 대표")).toBeInTheDocument();
    expect(screen.queryByText("대기 중 로컬 대표")).not.toBeInTheDocument();
  });

  it("does not park a pending old-vehicle response that resurfaces when vehicle A returns", async () => {
    let finish: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = image("cover-pending", "차량 A 대기 응답", T0, false);
    const vehicleA = vehicle({ images: [existingCover(), pending] });
    const vehicleBImage = image("cover-b", "차량 B 대표", T2, true);
    const rendered = render(<VehicleEditor vehicle={vehicleA} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "차량 A 대기 응답 대표로 지정" }));
    rendered.rerender(<VehicleEditor vehicle={vehicle({
      id: "vehicle-2", name: "싼타페", imageRevision: 2, updatedAt: T2, images: [vehicleBImage],
      thumbnailImageId: vehicleBImage.id, thumbnailUrl: vehicleBImage.storageUrl,
    })} />);
    await act(async () => { finish?.(success({ thumbnailImageId: pending.id, thumbnailUrl: pending.storageUrl, imageRevision: 1, vehicleUpdatedAt: T1 })); });

    const freshA = image("cover-a-fresh", "차량 A 최신 대표", T3, true);
    rendered.rerender(<VehicleEditor vehicle={vehicle({
      imageRevision: 3, updatedAt: T3, images: [freshA], thumbnailImageId: freshA.id, thumbnailUrl: freshA.storageUrl,
    })} />);
    expect(screen.getByText("차량 A 최신 대표")).toBeInTheDocument();
    expect(screen.queryByText("차량 A 대기 응답")).not.toBeInTheDocument();
  });
});

function successError(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: code, code }), {
    status, headers: { "Content-Type": "application/json" },
  });
}
