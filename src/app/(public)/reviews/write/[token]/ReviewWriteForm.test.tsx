import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => file),
}));

import { ReviewWriteForm } from "./ReviewWriteForm";

const TOKEN = "review-token";
const UPLOAD_ID = "upload-1";
const UPLOAD_URL = "https://cdn.example/review-images/one.jpg";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function uploadFile(name = "car.jpg") {
  return new File(["image-bytes"], name, { type: "image/jpeg" });
}

function fetchUrl(input: unknown): string {
  return typeof input === "string" ? input : String(input);
}

describe("ReviewWriteForm image quota release", () => {
  const fetchMock = vi.fn();
  const sendBeacon = vi.fn<(url: string, data?: Blob) => boolean>(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = fetchUrl(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === `/api/reviews/submit/${TOKEN}/image` && method === "POST") {
        return jsonResponse(
          {
            success: true,
            data: { id: UPLOAD_ID, path: "review-token-1/one.jpg", url: UPLOAD_URL },
          },
          201,
        );
      }
      if (url === `/api/reviews/submit/${TOKEN}/image/release` && method === "POST") {
        return jsonResponse({ success: true });
      }
      if (url === `/api/reviews/submit/${TOKEN}` && method === "POST") {
        return jsonResponse({ success: true, data: { reviewId: "review-1" } }, 201);
      }
      return jsonResponse({ error: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: sendBeacon,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function uploadOneImage() {
    render(
      <ReviewWriteForm
        token={TOKEN}
        vehicleName="테스트 차량"
        customerDisplayName="홍*동"
      />,
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile()] } });

    expect(await screen.findByAltText("첨부 이미지 1")).toBeInTheDocument();
  }

  function releaseCalls() {
    return fetchMock.mock.calls.filter(([input, init]) => {
      const url = fetchUrl(input);
      const method = ((init as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return url === `/api/reviews/submit/${TOKEN}/image/release` && method === "POST";
    });
  }

  it("removeImage 시 해당 reserve 를 release 엔드포인트로 반환한다", async () => {
    await uploadOneImage();

    fireEvent.click(screen.getByRole("button", { name: "이미지 제거" }));

    await waitFor(() => {
      expect(releaseCalls()).toHaveLength(1);
    });

    const init = releaseCalls()[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ uploadIds: [UPLOAD_ID] });
    expect(screen.queryByAltText("첨부 이미지 1")).not.toBeInTheDocument();
  });

  it("언마운트 시 미사용 reserve 전량을 release 한다", async () => {
    const view = render(
      <ReviewWriteForm
        token={TOKEN}
        vehicleName="테스트 차량"
        customerDisplayName="홍*동"
      />,
    );

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile()] } });
    expect(await screen.findByAltText("첨부 이미지 1")).toBeInTheDocument();

    view.unmount();

    await waitFor(() => {
      expect(releaseCalls()).toHaveLength(1);
    });

    const init = releaseCalls()[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ uploadIds: [UPLOAD_ID] });
    expect(init.keepalive).toBe(true);
  });

  it("remove 후 이탈하면 같은 reserve 를 두 번 release 하지 않는다", async () => {
    const view = render(
      <ReviewWriteForm
        token={TOKEN}
        vehicleName="테스트 차량"
        customerDisplayName="홍*동"
      />,
    );

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile()] } });
    expect(await screen.findByAltText("첨부 이미지 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "이미지 제거" }));
    await waitFor(() => {
      expect(releaseCalls()).toHaveLength(1);
    });

    view.unmount();
    await Promise.resolve();

    expect(releaseCalls()).toHaveLength(1);
  });

  it("release 가 실패해도 이미지 삭제는 막지 않는다", async () => {
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = fetchUrl(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === `/api/reviews/submit/${TOKEN}/image` && method === "POST") {
        return jsonResponse(
          {
            success: true,
            data: { id: UPLOAD_ID, path: "review-token-1/one.jpg", url: UPLOAD_URL },
          },
          201,
        );
      }
      if (url === `/api/reviews/submit/${TOKEN}/image/release`) {
        return jsonResponse({ error: "release failed" }, 500);
      }
      return jsonResponse({ error: "not found" }, 404);
    });

    await uploadOneImage();
    fireEvent.click(screen.getByRole("button", { name: "이미지 제거" }));

    await waitFor(() => {
      expect(screen.queryByAltText("첨부 이미지 1")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("이미지 업로드에 실패했습니다.")).not.toBeInTheDocument();
  });

  it("제출에 성공한 이미지는 beforeunload 때 release 하지 않는다", async () => {
    render(
      <ReviewWriteForm
        token={TOKEN}
        vehicleName="테스트 차량"
        customerDisplayName="홍*동"
      />,
    );

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile()] } });
    expect(await screen.findByAltText("첨부 이미지 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("후기 내용"), {
      target: { value: "충분히 긴 후기 내용입니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "후기 제출하기" }));
    expect(await screen.findByText("후기가 접수되었어요")).toBeInTheDocument();

    window.dispatchEvent(new Event("beforeunload"));
    await Promise.resolve();

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(releaseCalls()).toHaveLength(0);
  });

  it("제출에 성공한 이미지는 언마운트 때 release 하지 않는다", async () => {
    const view = render(
      <ReviewWriteForm
        token={TOKEN}
        vehicleName="테스트 차량"
        customerDisplayName="홍*동"
      />,
    );

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile()] } });
    expect(await screen.findByAltText("첨부 이미지 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("후기 내용"), {
      target: { value: "충분히 긴 후기 내용입니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "후기 제출하기" }));
    expect(await screen.findByText("후기가 접수되었어요")).toBeInTheDocument();

    view.unmount();
    await Promise.resolve();

    expect(releaseCalls()).toHaveLength(0);
  });

  it("beforeunload 에서는 sendBeacon 으로 미사용 reserve 를 보낸다", async () => {
    render(
      <ReviewWriteForm
        token={TOKEN}
        vehicleName="테스트 차량"
        customerDisplayName="홍*동"
      />,
    );

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile()] } });
    expect(await screen.findByAltText("첨부 이미지 1")).toBeInTheDocument();

    window.dispatchEvent(new Event("beforeunload"));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const beaconUrl = sendBeacon.mock.calls[0]?.[0];
    const beaconBody = sendBeacon.mock.calls[0]?.[1];
    expect(beaconUrl).toBe(`/api/reviews/submit/${TOKEN}/image/release`);
    expect(beaconBody).toBeInstanceOf(Blob);
    const payload = beaconBody as Blob;
    expect(payload.type).toBe("application/json");
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(payload);
    });
    expect(JSON.parse(text)).toEqual({ uploadIds: [UPLOAD_ID] });
    expect(releaseCalls()).toHaveLength(0);
  });

  it("beforeunload 는 마지막으로 업로드된 이미지 id 를 사용한다", async () => {
    let uploadCount = 0;
    fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
      const url = fetchUrl(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === `/api/reviews/submit/${TOKEN}/image` && method === "POST") {
        uploadCount += 1;
        return jsonResponse(
          {
            success: true,
            data: {
              id: `upload-${uploadCount}`,
              path: `review-token-1/${uploadCount}.jpg`,
              url: `https://cdn.example/review-images/${uploadCount}.jpg`,
            },
          },
          201,
        );
      }
      if (url === `/api/reviews/submit/${TOKEN}/image/release` && method === "POST") {
        return jsonResponse({ success: true });
      }
      return jsonResponse({ error: "not found" }, 404);
    });

    render(
      <ReviewWriteForm
        token={TOKEN}
        vehicleName="테스트 차량"
        customerDisplayName="홍*동"
      />,
    );

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile("one.jpg")] } });
    expect(await screen.findByAltText("첨부 이미지 1")).toBeInTheDocument();
    fireEvent.change(input as HTMLInputElement, { target: { files: [uploadFile("two.jpg")] } });
    expect(await screen.findByAltText("첨부 이미지 2")).toBeInTheDocument();

    window.dispatchEvent(new Event("beforeunload"));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const beaconBody = sendBeacon.mock.calls[0]?.[1];
    expect(beaconBody).toBeInstanceOf(Blob);
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(beaconBody as Blob);
    });
    expect(JSON.parse(text)).toEqual({ uploadIds: ["upload-1", "upload-2"] });
  });
});
