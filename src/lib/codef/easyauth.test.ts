import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildBaseParams,
  startEasyAuth,
  completeEasyAuth,
  type EasyAuthInput,
  type TwoWayInfo,
} from "@/lib/codef/easyauth";

// @/lib/codef 의 토큰 발급·원시 호출을 모킹 (외부 네트워크 차단)
vi.mock("@/lib/codef", () => ({
  getCodefToken: vi.fn(),
  callCodefRaw: vi.fn(),
}));

import { getCodefToken, callCodefRaw } from "@/lib/codef";

const mockToken = vi.mocked(getCodefToken);
const mockRaw = vi.mocked(callCodefRaw);

const baseInput: EasyAuthInput = {
  docType: "resident_register",
  userName: "홍길동",
  birthDate: "19900101",
  phoneNo: "01012345678",
  loginTypeLevel: "1", // 카카오톡
  id: "session-abc",
};

const twoWayInfo: TwoWayInfo = {
  jobIndex: 0,
  threadIndex: 0,
  jti: "jti-123",
  twoWayTimestamp: 1700000000000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockToken.mockResolvedValue({ success: true, data: "tok" });
});

describe("buildBaseParams", () => {
  it("회원 간편인증(loginType=5)과 origin 파라미터를 세팅한다 — 등본", () => {
    const p = buildBaseParams(baseInput);
    expect(p.loginType).toBe("5");
    expect(p.originDataYN).toBe("1"); // 등본 PDF 요청
    expect(p.loginIdentity).toBeUndefined(); // 등본 회원은 loginIdentity 불요
    expect(p.id).toBe("session-abc");
  });

  it("홈택스 상품은 loginIdentity(생년월일)·originDataYN1·제출용도를 세팅한다", () => {
    const p = buildBaseParams({ ...baseInput, docType: "biz_registration_proof" });
    expect(p.loginIdentity).toBe("19900101");
    expect(p.originDataYN1).toBe("1");
    expect(p.usePurposes).toBe("07");
    expect(p.submitTargets).toBe("01");
  });

  it("PASS(통신사)일 때만 telecom 을 싣는다", () => {
    expect(buildBaseParams(baseInput).telecom).toBeUndefined();
    const p = buildBaseParams({ ...baseInput, loginTypeLevel: "5", telecom: "0" });
    expect(p.telecom).toBe("0");
  });
});

describe("startEasyAuth", () => {
  it("CF-03002 응답이면 twoWayInfo 를 반환한다", async () => {
    mockRaw.mockResolvedValue({
      success: true,
      data: { code: "CF-03002", message: "추가인증", data: { ...twoWayInfo, continue2Way: true } },
    });
    const r = await startEasyAuth(baseInput);
    expect(r.kind).toBe("2way");
    if (r.kind === "2way") expect(r.twoWayInfo.jti).toBe("jti-123");
  });

  it("토큰 실패 시 error 를 반환한다", async () => {
    mockToken.mockResolvedValue({ success: false, error: "키 없음" });
    const r = await startEasyAuth(baseInput);
    expect(r.kind).toBe("error");
  });

  it("예상치 못한 코드면 error(code 포함)를 반환한다", async () => {
    mockRaw.mockResolvedValue({
      success: true,
      data: { code: "CF-12345", message: "오류", data: {} },
    });
    const r = await startEasyAuth(baseInput);
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("CF-12345");
  });
});

describe("completeEasyAuth", () => {
  it("등본 성공 시 resOriGinalData(PDF)·resDocNo 를 추출한다", async () => {
    mockRaw.mockResolvedValue({
      success: true,
      data: {
        code: "CF-00000",
        message: "성공",
        data: { resOriGinalData: "JVBERi0xLjQK", resDocNo: "1234-5678" },
      },
    });
    const r = await completeEasyAuth(baseInput, twoWayInfo);
    expect(r.success).toBe(true);
    expect(r.pdfBase64).toBe("JVBERi0xLjQK");
    expect(r.docVerifyNo).toBe("1234-5678");
  });

  it("홈택스 성공 시 resOriGinalData1(PDF)·resIssueNo 를 추출한다", async () => {
    mockRaw.mockResolvedValue({
      success: true,
      data: {
        code: "CF-00000",
        message: "성공",
        data: { resOriGinalData1: "UERGREFUQQ==", resIssueNo: "BIZ-1" },
      },
    });
    const r = await completeEasyAuth(
      { ...baseInput, docType: "biz_registration_proof" },
      twoWayInfo
    );
    expect(r.pdfBase64).toBe("UERGREFUQQ==");
    expect(r.docVerifyNo).toBe("BIZ-1");
  });

  it("다건 리스트 응답이면 첫 항목을 사용한다", async () => {
    mockRaw.mockResolvedValue({
      success: true,
      data: {
        code: "CF-00000",
        message: "성공",
        data: [{ resOriGinalData: "AAAA", resDocNo: "D1" }],
      },
    });
    const r = await completeEasyAuth(baseInput, twoWayInfo);
    expect(r.pdfBase64).toBe("AAAA");
  });

  it("실패 코드면 success=false 와 code 를 반환한다", async () => {
    mockRaw.mockResolvedValue({
      success: true,
      data: { code: "CF-12872", message: "간편인증 미완료", data: {} },
    });
    const r = await completeEasyAuth(baseInput, twoWayInfo);
    expect(r.success).toBe(false);
    expect(r.code).toBe("CF-12872");
  });
});
