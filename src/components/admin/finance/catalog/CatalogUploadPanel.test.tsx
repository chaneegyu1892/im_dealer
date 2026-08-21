import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CatalogUploadPanel from "./CatalogUploadPanel";

const BASE = { financeCompanyId: "fc-1", financeCompanyName: "메리츠캐피탈" };

const PREVIEW = {
  success: true,
  preview: true,
  products: [
    {
      productType: "장기렌트",
      models: [
        { modelName: "쏘나타 디엣지", trims: 12 },
        { modelName: "캐스퍼", trims: 6 },
        { modelName: "그랜저", trims: 9 },
      ],
    },
  ],
};

let posted: FormData[] = [];

beforeEach(() => {
  posted = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const fd = init?.body as FormData;
    posted.push(fd);
    if (fd.get("mode") === "preview") return { ok: true, json: async () => PREVIEW };
    return { ok: true, json: async () => ({ success: true, weekOf: "2026-08-17", results: [] }) };
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** jsdom 파일 선택 흉내. */
function pickFile() {
  const input = document.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(["x"], "메리츠.xlsm")] } });
}

describe("CatalogUploadPanel", () => {
  it("파일 분석 후 차량을 골라 선택분만 저장한다", async () => {
    render(<CatalogUploadPanel {...BASE} />);
    pickFile();
    fireEvent.click(screen.getByRole("button", { name: "차량 골라서 가져오기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /쏘나타 디엣지/ })).toBeTruthy());
    // 기본은 전체 선택 — 전체 해제 후 2대만 담는다
    fireEvent.click(screen.getByRole("button", { name: "전체 해제" }));
    fireEvent.click(screen.getByRole("button", { name: /쏘나타 디엣지/ }));
    fireEvent.click(screen.getByRole("button", { name: /캐스퍼/ }));
    fireEvent.click(screen.getByRole("button", { name: "선택 2대 가져오기" }));

    await waitFor(() => expect(posted).toHaveLength(2));
    // 1차 = preview, 2차 = 선택 모델만 담긴 저장 요청
    expect(posted[0].get("mode")).toBe("preview");
    expect(JSON.parse(String(posted[1].get("models")))).toEqual(["쏘나타 디엣지", "캐스퍼"]);
  });

  it("전체 업로드는 models 없이 보낸다 (기존 동작)", async () => {
    render(<CatalogUploadPanel {...BASE} />);
    pickFile();
    fireEvent.click(screen.getByRole("button", { name: "전체 업로드" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].get("models")).toBeNull();
    expect(posted[0].get("mode")).toBeNull();
  });
});
