import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { compileOverlapCatalog } from "@/lib/recommend/overlap-catalog";
import type { VehicleAiConfigDto } from "@/types/admin-ai";
import ProfileEditor from "./ProfileEditor";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

const profile = compileOverlapCatalog()[0]?.profile;

function row(configured: boolean, state: VehicleAiConfigDto["profileState"] = "valid"): VehicleAiConfigDto {
  return {
    vehicle: { id: "vehicle", slug: "safe", name: "테스트 차량", brand: "테스트", category: "SUV", isVisible: true },
    config: configured ? {
      id: "config",
      profile: state === "valid" ? profile : { industry: { 법인: 9 } },
      isActive: true,
      highlights: ["기존"],
      aiCaption: "기존 캡션",
      updatedAt: "2026-07-12T00:00:00.000Z",
    } : null,
    profileState: configured ? state : "missing",
    fuelGroup: configured && state === "valid" && profile ? profile.fuelGroup : null,
    exclusion: null,
    coverage: { "10000": configured ? "eligible" : "no_profile", "20000": configured ? "eligible" : "no_profile", "30000": configured ? "eligible" : "no_profile" },
  };
}

function success(scoreMatrix: unknown = profile, isActive = true): Response {
  return new Response(JSON.stringify({
    data: {
      id: "config",
      vehicleId: "vehicle",
      scoreMatrix,
      highlights: ["저장"],
      aiCaption: null,
      isActive,
      updatedAt: "2026-07-12T01:00:00.000Z",
    },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("ProfileEditor", () => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(success());
  });

  it("creates a complete structured profile without a JSON textarea", async () => {
    render(<ProfileEditor row={row(false)} onClose={onClose} onSaved={onSaved} />);
    expect(screen.getByLabelText("연료 그룹")).toBeInTheDocument();
    expect(screen.getByLabelText("등록 형태 법인")).toBeInTheDocument();
    expect(screen.getByLabelText("자녀 연령 영유아")).toBeInTheDocument();
    expect(screen.queryByText(/추천 점수 매트릭스 \(JSON\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "프로필 저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body);
    expect(body.action).toBe("create");
    expect(body.profile.version).toBe("overlap-v2");
  });

  it("updates with expectedUpdatedAt and explicit metadata edits", async () => {
    render(<ProfileEditor row={row(true)} onClose={onClose} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("회사 우선순위 (0~100)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("추천 캡션"), { target: { value: "새 캡션" } });
    fireEvent.click(screen.getByRole("button", { name: "프로필 저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body);
    expect(body.action).toBe("update");
    expect(body.expectedUpdatedAt).toBe("2026-07-12T00:00:00.000Z");
    expect(body.profile.companyPriority).toBe(12);
    expect(body.aiCaption).toBe("새 캡션");
  });

  it("deactivates a legacy config without forcing profile migration", async () => {
    fetchMock.mockResolvedValue(success({ industry: { 법인: 9 } }, false));
    render(<ProfileEditor row={row(true, "legacy")} onClose={onClose} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "비활성화" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1].body);
    expect(body).toEqual({ action: "deactivate", vehicleId: "vehicle", expectedUpdatedAt: "2026-07-12T00:00:00.000Z" });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("vehicle", expect.objectContaining({ profileState: "legacy", isActive: false })));
  });

  it("blocks stale resubmission and closes before loading the latest state", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "conflict" }), { status: 409 }));
    render(<ProfileEditor row={row(true)} onClose={onClose} onSaved={onSaved} />);
    const caption = screen.getByLabelText("추천 캡션");
    fireEvent.change(caption, { target: { value: "잃으면 안 되는 초안" } });
    fireEvent.click(screen.getByRole("button", { name: "프로필 저장" }));
    expect(await screen.findByText(/다른 관리자의 변경/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("잃으면 안 되는 초안")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로필 저장" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "닫고 최신 상태 불러오기" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
