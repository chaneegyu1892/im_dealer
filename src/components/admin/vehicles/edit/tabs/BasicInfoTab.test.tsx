import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminVehicleDetail, AdminVehicleImage } from "@/types/admin";
import { BasicInfoTab } from "./BasicInfoTab";
import { VehicleEditor } from "../VehicleEditor";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const vehicle: AdminVehicleDetail = {
  id: "vehicle-1",
  slug: "sorento",
  name: "쏘렌토",
  brand: "기아",
  category: "SUV",
  vehicleCode: "MQ4",
  basePrice: 40_000_000,
  thumbnailUrl: "/representative.webp",
  imageUrls: ["/detail.webp"],
  surchargeRate: 0,
  isVisible: true,
  isPopular: false,
  isSpotlight: false,
  slidingDoorOverride: null,
  advancedSafetyOverride: null,
  displayOrder: 0,
  tags: ["패밀리"],
  description: "대표 SUV",
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
  thumbnailImageId: "image-cover",
  imageRevision: 0,
  images: [],
  trims: [],
  lineups: [],
  colors: [],
};

describe("BasicInfoTab", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("alert", vi.fn());
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
  });

  it("saves edited non-image basic information", async () => {
    render(<BasicInfoTab vehicle={vehicle} onOpenImages={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue("쏘렌토"), {
      target: { value: "더 뉴 쏘렌토" },
    });
    fireEvent.click(screen.getByRole("button", { name: "기본 정보 저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: "더 뉴 쏘렌토",
      brand: "기아",
      category: "SUV",
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows a read-only representative preview and hands off to image management", () => {
    const onOpenImages = vi.fn();
    render(<BasicInfoTab vehicle={vehicle} onOpenImages={onOpenImages} />);

    expect(screen.getByRole("img", { name: "쏘렌토 대표 이미지" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/이미지 경로|URL/)).not.toBeInTheDocument();
    expect(screen.queryByText("추가 이미지 목록")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이미지 관리로 이동" }));
    expect(onOpenImages).toHaveBeenCalledOnce();
  });

  it("keeps a missing representative read-only with an explicit empty state", () => {
    render(
      <BasicInfoTab
        vehicle={{ ...vehicle, thumbnailUrl: "", thumbnailImageId: null }}
        onOpenImages={vi.fn()}
      />
    );

    expect(screen.getByText("대표 이미지가 없습니다")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /이미지/ })).not.toBeInTheDocument();
  });

  it("never includes legacy image fields in the BasicInfo PATCH payload", async () => {
    render(<BasicInfoTab vehicle={vehicle} onOpenImages={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "기본 정보 저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body));
    expect(body).not.toHaveProperty("thumbnailUrl");
    expect(body).not.toHaveProperty("imageUrls");
  });

  it("opens the real VehicleEditor image tab repeatedly", () => {
    render(<VehicleEditor vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "이미지 관리로 이동" }));
    expect(screen.getByRole("heading", { name: "차량 이미지 관리" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "기본정보" }));
    fireEvent.click(screen.getByRole("button", { name: "이미지 관리로 이동" }));
    expect(screen.getByRole("heading", { name: "차량 이미지 관리" })).toBeInTheDocument();
  });

  it("shows a newly selected representative after returning to basic info without a router refresh", async () => {
    const oldImage = {
      id: "image-old", type: "COVER" as const, origin: "CARPAN2" as const, title: "기존 표지",
      storageUrl: "/old.webp", sourceUrl: null, sourceKey: "old", displayOrder: 0, isVisible: true,
      deletedAt: null, createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z", isRepresentative: true,
    };
    const nextImage = { ...oldImage, id: "image-new", title: "새 표지", storageUrl: "/new.webp", sourceKey: "new", displayOrder: 1, isRepresentative: false };
    fetchMock
      .mockResolvedValueOnce(successResponse({
        thumbnailImageId: nextImage.id,
        thumbnailUrl: nextImage.storageUrl,
        imageRevision: 1,
        vehicleUpdatedAt: "2026-07-13T03:00:00.000Z",
      }))
      .mockResolvedValueOnce(authoritativeImageListResponse(
        [{ ...oldImage, isRepresentative: false }, { ...nextImage, isRepresentative: true }],
        nextImage, 1, "2026-07-13T03:00:00.000Z",
      ));
    render(<VehicleEditor vehicle={{ ...vehicle, thumbnailUrl: oldImage.storageUrl, thumbnailImageId: oldImage.id, images: [oldImage, nextImage] }} />);

    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "새 표지 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("tab", { name: "기본정보" }));

    expect(screen.getByRole("img", { name: "쏘렌토 대표 이미지" })).toHaveAttribute("src", "/new.webp");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("resets the image snapshot when the vehicle id prop changes", () => {
    const { rerender } = render(<VehicleEditor vehicle={vehicle} />);
    expect(screen.getByRole("img", { name: "쏘렌토 대표 이미지" })).toHaveAttribute("src", "/representative.webp");

    rerender(<VehicleEditor vehicle={{ ...vehicle, id: "vehicle-2", name: "싼타페", thumbnailUrl: "/santafe.webp", thumbnailImageId: "santafe-cover" }} />);
    expect(screen.getByRole("img", { name: "싼타페 대표 이미지" })).toHaveAttribute("src", "/santafe.webp");
  });

  it("uses a newer same-vehicle SSR version without losing the locally published representative", async () => {
    const oldImage = vehicleImage("image-old", "기존 표지", "/old.webp", true);
    const nextImage = vehicleImage("image-new", "새 표지", "/new.webp", false);
    fetchMock
      .mockResolvedValueOnce(successResponse({
        thumbnailImageId: nextImage.id,
        thumbnailUrl: nextImage.storageUrl,
        imageRevision: 1,
        vehicleUpdatedAt: "2026-07-13T01:00:00.000Z",
      }))
      .mockResolvedValueOnce(authoritativeImageListResponse(
        [{ ...oldImage, isRepresentative: false }, { ...nextImage, isRepresentative: true }],
        nextImage, 1, "2026-07-13T01:00:00.000Z",
      ))
      .mockResolvedValueOnce(successResponse(undefined))
      .mockResolvedValueOnce(successResponse({
        thumbnailImageId: oldImage.id,
        thumbnailUrl: oldImage.storageUrl,
        imageRevision: 2,
        vehicleUpdatedAt: "2026-07-13T03:00:00.000Z",
      }))
      .mockResolvedValueOnce(authoritativeImageListResponse(
        [{ ...oldImage, isRepresentative: true }, { ...nextImage, isRepresentative: false }],
        oldImage, 2, "2026-07-13T03:00:00.000Z",
      ));
    const initial = { ...vehicle, thumbnailUrl: oldImage.storageUrl, thumbnailImageId: oldImage.id, images: [oldImage, nextImage] };
    const rendered = render(<VehicleEditor vehicle={initial} />);

    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "새 표지 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("tab", { name: "기본정보" }));
    fireEvent.click(screen.getByRole("button", { name: "기본 정보 저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    rendered.rerender(<VehicleEditor vehicle={{
      ...initial,
      name: "더 뉴 쏘렌토",
      updatedAt: "2026-07-13T02:00:00.000Z",
      imageRevision: 1,
      thumbnailImageId: nextImage.id,
      thumbnailUrl: nextImage.storageUrl,
      images: [
        { ...oldImage, isRepresentative: false },
        { ...nextImage, isRepresentative: true },
      ],
    }} />);
    expect(screen.getByRole("img", { name: "더 뉴 쏘렌토 대표 이미지" })).toHaveAttribute("src", "/new.webp");
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    fireEvent.click(screen.getByRole("button", { name: "기존 표지 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    const request = fetchMock.mock.calls[3]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      expectedVehicleUpdatedAt: "2026-07-13T02:00:00.000Z",
    });
  });

  it("atomically resets the visible image tab when the vehicle id changes", async () => {
    const oldImage = vehicleImage("image-old", "쏘렌토 표지", "/old.webp", false);
    const nextImage = vehicleImage("image-next", "싼타페 표지", "/santafe.webp", false);
    fetchMock.mockResolvedValueOnce(successResponse({
      thumbnailImageId: nextImage.id,
      thumbnailUrl: nextImage.storageUrl,
      imageRevision: 1,
      vehicleUpdatedAt: "2026-07-13T04:00:00.000Z",
    }));
    const rendered = render(<VehicleEditor vehicle={{ ...vehicle, images: [oldImage], thumbnailImageId: null, thumbnailUrl: "" }} />);
    fireEvent.click(screen.getByRole("tab", { name: "이미지" }));
    expect(screen.getByText("쏘렌토 표지")).toBeInTheDocument();

    rendered.rerender(<VehicleEditor vehicle={{ ...vehicle, id: "vehicle-2", name: "싼타페", images: [nextImage], thumbnailImageId: null, thumbnailUrl: "", updatedAt: "2026-07-13T03:00:00.000Z" }} />);
    expect(screen.queryByText("쏘렌토 표지")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "싼타페 표지 대표로 지정" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/vehicles/vehicle-2/images/image-next/representative");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      expectedVehicleUpdatedAt: "2026-07-13T03:00:00.000Z",
    });
  });

  it("keeps the long tab strip scrollable at the 320px contract", () => {
    render(<VehicleEditor vehicle={vehicle} />);
    expect(screen.getByRole("tablist", { name: "차량 상세 관리" })).toHaveClass("overflow-x-auto");
    expect(screen.getByRole("tab", { name: "이미지" })).toHaveClass("shrink-0");
  });

  it("gives the icon-only vehicle-list link a named 44px touch target", () => {
    render(<VehicleEditor vehicle={vehicle} />);
    expect(screen.getByTestId("vehicle-editor")).toHaveClass("bg-[#F8F9FC]");
    const back = screen.getByRole("link", { name: "차량 목록으로 돌아가기" });
    expect(back).toHaveAttribute("title", "차량 목록으로 돌아가기");
    expect(back).toHaveClass("min-h-11", "min-w-11");
  });

  it("uses roving arrow-key tabs with controlled tabpanel relationships", () => {
    render(<VehicleEditor vehicle={vehicle} />);
    const basic = screen.getByRole("tab", { name: "기본정보" });
    const lineup = screen.getByRole("tab", { name: "라인업" });
    basic.focus();
    fireEvent.keyDown(basic, { key: "ArrowRight" });
    expect(lineup).toHaveFocus();
    expect(lineup).toHaveAttribute("aria-selected", "true");
    expect(lineup).toHaveAttribute("aria-controls", "vehicle-tabpanel-lineup");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "vehicle-tab-lineup");
  });
});

function vehicleImage(id: string, title: string, storageUrl: string, isRepresentative: boolean) {
  return {
    id, type: "COVER" as const, origin: "CARPAN2" as const, title, storageUrl,
    sourceUrl: null, sourceKey: id, displayOrder: 0, isVisible: true, deletedAt: null,
    createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z", isRepresentative,
  };
}

function successResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function authoritativeImageListResponse(images: readonly AdminVehicleImage[], representative: AdminVehicleImage, imageRevision: number, vehicleUpdatedAt: string): Response {
  return successResponse({
    images, thumbnailImageId: representative.id, thumbnailUrl: representative.storageUrl,
    imageRevision, vehicleUpdatedAt,
  });
}
