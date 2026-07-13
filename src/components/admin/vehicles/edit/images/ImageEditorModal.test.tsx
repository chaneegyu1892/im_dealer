import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageEditorModal } from "./ImageEditorModal";

describe("ImageEditorModal", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("uploads through the dedicated multipart endpoint with the exact fields", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { image: {
      id: "new-image", type: "COVER", origin: "ADMIN", title: "새 커버", storageUrl: "/new.webp",
      sourceUrl: null, sourceKey: "admin:new", displayOrder: 0, isVisible: true, deletedAt: null,
      createdAt: "2026-07-13T00:00:00.000Z", updatedAt: "2026-07-13T00:00:00.000Z",
    }, imageRevision: 1, vehicleUpdatedAt: "2026-07-13T00:00:00.000Z" } }), { status: 201 }));
    const onSaved = vi.fn();
    render(<ImageEditorModal vehicleId="vehicle-1" initialType="COVER" image={null} expectedImageRevision={0} onClose={vi.fn()} onSaved={onSaved} onConflict={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("이미지 파일"), { target: { files: [new File(["image"], "cover.webp", { type: "image/webp" })] } });
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "새 커버" } });
    fireEvent.submit(screen.getByRole("button", { name: "이미지 업로드" }).closest("form") ?? document.body);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/vehicles/vehicle-1/images");
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("title")).toBe("새 커버");
    expect((body as FormData).get("type")).toBe("COVER");
    expect((body as FormData).get("isVisible")).toBe("true");
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("keeps visible labels, dialog semantics, and reports API errors", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "입력값이 올바르지 않습니다." }), { status: 400 }));
    render(<ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={null} expectedImageRevision={0} onClose={vi.fn()} onSaved={vi.fn()} onConflict={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "이미지 추가" })).toBeInTheDocument();
    expect(screen.getByTestId("image-editor-motion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이미지 편집 닫기" })).toHaveClass("backdrop-blur-sm");
    expect(screen.getByLabelText("이미지 유형")).toBeInTheDocument();
    expect(screen.getByLabelText("이미지 파일")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp,image/gif"
    );
    expect(screen.getByText("JPG, PNG, WebP, GIF 파일")).toBeInTheDocument();
    expect(screen.queryByText(/AVIF/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("이미지 파일"), { target: { files: [new File(["x"], "x.png", { type: "image/png" })] } });
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "오류 이미지" } });
    fireEvent.submit(screen.getByRole("button", { name: "이미지 업로드" }).closest("form") ?? document.body);
    expect(await screen.findByRole("alert")).toHaveTextContent("입력값이 올바르지 않습니다.");
  });

  it("translates an unsupported upload MIME code for the admin", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "UNSUPPORTED_MIME" }), { status: 400 }));
    render(<ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={null} expectedImageRevision={0} onClose={vi.fn()} onSaved={vi.fn()} onConflict={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("이미지 파일"), { target: { files: [new File(["x"], "x.txt", { type: "text/plain" })] } });
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "잘못된 형식" } });
    fireEvent.submit(screen.getByRole("button", { name: "이미지 업로드" }).closest("form") ?? document.body);
    expect(await screen.findByRole("alert")).toHaveTextContent("JPG, PNG, WebP, GIF 이미지 파일만 업로드할 수 있습니다.");
  });

  it("routes 409 responses to the inline conflict state", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: "STALE_IMAGE_REVISION" }), { status: 409 }));
    const onConflict = vi.fn();
    render(<ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={{
      id: "image-1", type: "MAIN", origin: "ADMIN", title: "기존", storageUrl: "/old.webp",
      sourceUrl: null, sourceKey: "old", displayOrder: 0, isVisible: true, deletedAt: null,
      createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z", isRepresentative: false,
    }} expectedImageRevision={7} onClose={vi.fn()} onSaved={vi.fn()} onConflict={onConflict} />);
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "변경" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(onConflict).toHaveBeenCalledWith("STALE_IMAGE_REVISION"));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ expectedImageRevision: 7 });
  });

  it("publishes a live save after the StrictMode setup-cleanup-setup cycle", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { image: {
      id: "new-image", type: "COVER", origin: "ADMIN", title: "StrictMode 커버", storageUrl: "/strict.webp",
      sourceUrl: null, sourceKey: "admin:strict", displayOrder: 0, isVisible: true, deletedAt: null,
      createdAt: "2026-07-13T00:00:00.000Z", updatedAt: "2026-07-13T01:00:00.000Z",
    }, imageRevision: 1, vehicleUpdatedAt: "2026-07-13T01:00:00.000Z" } }), { status: 201 }));
    const onSaved = vi.fn();
    render(<StrictMode><ImageEditorModal vehicleId="vehicle-1" initialType="COVER" image={null} expectedImageRevision={0} onClose={vi.fn()} onSaved={onSaved} onConflict={vi.fn()} /></StrictMode>);
    fireEvent.change(screen.getByLabelText("이미지 파일"), { target: { files: [new File(["image"], "strict.webp", { type: "image/webp" })] } });
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "StrictMode 커버" } });

    fireEvent.submit(screen.getByRole("button", { name: "이미지 업로드" }).closest("form") ?? document.body);

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it("moves focus into the dialog and restores it after unmount", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const rendered = render(<ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={null} expectedImageRevision={0} onClose={vi.fn()} onSaved={vi.fn()} onConflict={vi.fn()} />);
    expect(screen.getByLabelText("이미지 파일")).toHaveFocus();
    rendered.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("does not restore opener focus during a pending or failed save", async () => {
    let finish: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const focusSpy = vi.spyOn(trigger, "focus");
    const rendered = render(<ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={{
      id: "image-1", type: "MAIN", origin: "ADMIN", title: "기존", storageUrl: "/old.webp", sourceUrl: null,
      sourceKey: "old", displayOrder: 0, isVisible: true, deletedAt: null, createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:00:00.000Z", isRepresentative: false,
    }} expectedImageRevision={0} onClose={vi.fn()} onSaved={vi.fn()} onConflict={vi.fn()} />);
    fireEvent.submit(screen.getByRole("button", { name: "변경사항 저장" }).closest("form") ?? document.body);
    expect(focusSpy).not.toHaveBeenCalled();
    finish?.(new Response(JSON.stringify({ error: "입력 오류" }), { status: 400 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("입력 오류");
    expect(focusSpy).not.toHaveBeenCalled();
    rendered.unmount();
    expect(focusSpy).toHaveBeenCalledOnce();
    trigger.remove();
  });

  it("aborts a pending save and never publishes success after unmount", async () => {
    let finish: ((response: Response) => void) | undefined;
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    const onSaved = vi.fn();
    const rendered = render(<ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={{
      id: "image-1", type: "MAIN", origin: "ADMIN", title: "기존", storageUrl: "/old.webp",
      sourceUrl: null, sourceKey: "old", displayOrder: 0, isVisible: true, deletedAt: null,
      createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-12T00:00:00.000Z", isRepresentative: false,
    }} expectedImageRevision={0} onClose={vi.fn()} onSaved={onSaved} onConflict={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    rendered.unmount();

    expect(signal?.aborted).toBe(true);
    await act(async () => { finish?.(new Response(JSON.stringify({ success: true, data: { image: {
      id: "image-1", type: "MAIN", origin: "ADMIN", title: "변경", storageUrl: "/old.webp",
      sourceUrl: null, sourceKey: "old", displayOrder: 0, isVisible: true, deletedAt: null,
      createdAt: "2026-07-12T00:00:00.000Z", updatedAt: "2026-07-13T00:00:00.000Z",
    }, imageRevision: 1, vehicleUpdatedAt: "2026-07-13T00:00:00.000Z" } }), { status: 200 })); });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("restores opener focus after a successful save closes the modal", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { image: {
      id: "image-1", type: "MAIN", origin: "ADMIN", title: "변경", storageUrl: "/old.webp", sourceUrl: null,
      sourceKey: "old", displayOrder: 0, isVisible: true, deletedAt: null, createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    }, imageRevision: 1, vehicleUpdatedAt: "2026-07-13T00:00:00.000Z" } }), { status: 200 }));
    render(<FocusHarness />);
    const opener = screen.getByRole("button", { name: "편집 열기" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText("이미지 제목"), { target: { value: "변경" } });
    fireEvent.submit(screen.getByRole("button", { name: "변경사항 저장" }).closest("form") ?? document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("traps Tab and Shift+Tab and closes with Escape", () => {
    const onClose = vi.fn();
    render(<ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={null} expectedImageRevision={0} onClose={onClose} onSaved={vi.fn()} onConflict={vi.fn()} />);
    const close = screen.getByRole("button", { name: "닫기" });
    const submit = screen.getByRole("button", { name: "이미지 업로드" });
    submit.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(submit).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

function FocusHarness() {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>편집 열기</button>{open && <ImageEditorModal vehicleId="vehicle-1" initialType="MAIN" image={{
    id: "image-1", type: "MAIN", origin: "ADMIN", title: "기존", storageUrl: "/old.webp", sourceUrl: null,
    sourceKey: "old", displayOrder: 0, isVisible: true, deletedAt: null, createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z", isRepresentative: false,
  }} expectedImageRevision={0} onClose={() => setOpen(false)} onSaved={vi.fn()} onConflict={vi.fn()} />}</>;
}
