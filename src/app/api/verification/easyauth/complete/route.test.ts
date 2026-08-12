import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  completeEasyAuth: vi.fn(),
  create: vi.fn(),
  verificationFindFirst: vi.fn(),
  documentFindFirst: vi.fn(),
  update: vi.fn(),
  requireActiveUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerVerification: {
      findFirst: mocks.verificationFindFirst,
    },
    verificationDocument: {
      findFirst: mocks.documentFindFirst,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/codef/easyauth", () => ({
  completeEasyAuth: mocks.completeEasyAuth,
}));

vi.mock("@/lib/pii", () => ({
  encryptPII: vi.fn((value: unknown) => ({ encrypted: value })),
  encryptString: vi.fn((value: string | null) => value),
}));

import { completeEasyAuth } from "@/lib/codef/easyauth";

const mockedCompleteEasyAuth = vi.mocked(completeEasyAuth);

function request(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/verification/easyauth/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/verification/easyauth/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveUser.mockResolvedValue({
      user: { id: "member-1", supabaseId: "u1", isActive: true },
      error: null,
    });
    mocks.verificationFindFirst.mockResolvedValue({ id: "v1", customerType: "individual" });
    mocks.documentFindFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
  });

  it("blocks an inactive account before calling Codef or reading verification data", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "비활성화된 계정입니다." }), { status: 403 }),
    });

    const response = await POST(request({}));

    expect(response.status).toBe(403);
    expect(mocks.verificationFindFirst).not.toHaveBeenCalled();
    expect(mockedCompleteEasyAuth).not.toHaveBeenCalled();
  });

  it("stores the Codef failure message when document issuance fails", async () => {
    mockedCompleteEasyAuth.mockResolvedValue({
      success: false,
      pdfBase64: null,
      docVerifyNo: null,
      code: "CF-12832",
      error: "발급 실패 [CF-12832]: 발급 가능한 문서가 없습니다.",
    });

    const response = await POST(
      request({
        verificationId: "v1",
        docType: "income_proof",
        userName: "홍길동",
        phoneNo: "01012345678",
        loginTypeLevel: "1",
        id: "v1",
        birthDate: "19900101",
        twoWayInfo: {
          jobIndex: 0,
          threadIndex: 0,
          jti: "jti",
          twoWayTimestamp: 1700000000000,
        },
      })
    );

    expect(response.status).toBe(502);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          failReason: "발급 실패 [CF-12832]: 발급 가능한 문서가 없습니다.",
        }),
      })
    );
  });

  it("rejects a document type that is not allowed for the verification customer type", async () => {
    const response = await POST(
      request({
        verificationId: "v1",
        docType: "financial_statements",
        userName: "홍길동",
        phoneNo: "01012345678",
        loginTypeLevel: "1",
        id: "v1",
        birthDate: "19900101",
        twoWayInfo: {
          jobIndex: 0,
          threadIndex: 0,
          jti: "jti",
          twoWayTimestamp: 1700000000000,
        },
      })
    );

    expect(response.status).toBe(400);
    expect(mockedCompleteEasyAuth).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
