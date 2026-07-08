import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  completeEasyAuth: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerVerification: {
      findUnique: mocks.findUnique,
    },
    verificationDocument: {
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
    },
  },
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
    mocks.findUnique.mockResolvedValue({ id: "v1" });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
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
        docType: "income_withholding",
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
});
