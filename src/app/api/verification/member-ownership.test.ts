import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  savedQuoteFindUnique: vi.fn(),
  savedQuoteUpdateMany: vi.fn(),
  verificationCreate: vi.fn(),
  verificationFindFirst: vi.fn(),
  verificationFindUnique: vi.fn(),
  verificationUpsert: vi.fn(),
  verificationUpdate: vi.fn(),
  documentFindFirst: vi.fn(),
  documentCreate: vi.fn(),
  documentUpdate: vi.fn(),
  startEasyAuth: vi.fn(),
  completeEasyAuth: vi.fn(),
  verifyDriverLicense: vi.fn(),
  verifyHealthInsurance: vi.fn(),
  verifyBusiness: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: {
      findUnique: mocks.savedQuoteFindUnique,
      updateMany: mocks.savedQuoteUpdateMany,
    },
    customerVerification: {
      create: mocks.verificationCreate,
      findFirst: mocks.verificationFindFirst,
      findUnique: mocks.verificationFindUnique,
      upsert: mocks.verificationUpsert,
      update: mocks.verificationUpdate,
    },
    verificationDocument: {
      findFirst: mocks.documentFindFirst,
      create: mocks.documentCreate,
      update: mocks.documentUpdate,
    },
  },
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/codef/easyauth", () => ({
  startEasyAuth: mocks.startEasyAuth,
  completeEasyAuth: mocks.completeEasyAuth,
}));

vi.mock("@/lib/codef", () => ({
  verifyDriverLicense: mocks.verifyDriverLicense,
  verifyHealthInsurance: mocks.verifyHealthInsurance,
  verifyBusiness: mocks.verifyBusiness,
}));

vi.mock("@/lib/pii", () => ({
  encryptPII: vi.fn((value: unknown) => ({ encrypted: value })),
  encryptString: vi.fn((value: string | null) => value),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
}));

import { POST as consent } from "./consent/route";
import { POST as start } from "./easyauth/start/route";
import { POST as complete } from "./easyauth/complete/route";
import { POST as fetchVerification } from "./fetch/route";
import { hashVerificationCapability } from "@/lib/verification-capability";

const activeUser = { id: "member-db-1", supabaseId: "member-1", isActive: true };

function request(path: string, body: unknown): NextRequest {
  return new NextRequest(`https://example.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const easyAuthBody = {
  verificationId: "victim-verification",
  docType: "income_proof",
  userName: "홍길동",
  phoneNo: "01012345678",
  loginTypeLevel: "1",
  id: "victim-verification",
  birthDate: "19900101",
};

describe("member verification ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveUser.mockResolvedValue({ user: activeUser, error: null });
    mocks.savedQuoteUpdateMany.mockResolvedValue({ count: 0 });
    mocks.verificationCreate.mockResolvedValue({ id: "verification-1" });
    mocks.verificationUpsert.mockResolvedValue({ id: "verification-1" });
    mocks.verificationFindUnique.mockResolvedValue({
      id: "victim-verification",
      userId: "victim-member",
      customerType: "individual",
    });
    mocks.verificationFindFirst.mockResolvedValue(null);
    mocks.documentFindFirst.mockResolvedValue(null);
    mocks.documentCreate.mockResolvedValue({});
    mocks.documentUpdate.mockResolvedValue({});
    mocks.startEasyAuth.mockResolvedValue({ kind: "error", code: "CF-00001", error: "failed" });
    mocks.completeEasyAuth.mockResolvedValue({
      success: true,
      pdfBase64: "pdf",
      docVerifyNo: "verify-no",
    });
    mocks.verifyDriverLicense.mockResolvedValue({ success: true, data: { resAuthenticity: "1" } });
    mocks.verifyHealthInsurance.mockResolvedValue({ success: true, data: {} });
    mocks.verifyBusiness.mockResolvedValue({ success: true, data: { resBusinessStatus: "01" } });
    mocks.cookieGet.mockReturnValue(undefined);
  });

  it("rejects consent for a different member's quote before creating a verification", async () => {
    mocks.savedQuoteFindUnique.mockResolvedValue({
      id: "quote-victim",
      userId: "victim-member",
      customerType: "individual",
      deletedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      verificationCapabilityHash: null,
    });

    const response = await consent(
      request("/api/verification/consent", {
        sessionId: "victim-session",
        customerType: "individual",
        consentedAt: "2026-07-28T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.verificationCreate).not.toHaveBeenCalled();
    expect(mocks.verificationUpsert).not.toHaveBeenCalled();
  });

  it("rejects an unowned quote without its browser-held verification capability", async () => {
    mocks.savedQuoteFindUnique.mockResolvedValue({
      id: "quote-unowned",
      userId: null,
      customerType: "individual",
      deletedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      verificationCapabilityHash: "a".repeat(64),
    });

    const response = await consent(
      request("/api/verification/consent", {
        sessionId: "victim-session",
        customerType: "individual",
        consentedAt: "2026-07-28T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.savedQuoteUpdateMany).not.toHaveBeenCalled();
    expect(mocks.verificationCreate).not.toHaveBeenCalled();
  });

  it("creates or reuses only the active member's verification record for an owned quote", async () => {
    mocks.savedQuoteFindUnique.mockResolvedValue({
      id: "quote-owned",
      userId: "member-1",
      customerType: "individual",
      deletedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      verificationCapabilityHash: null,
    });

    const response = await consent(
      request("/api/verification/consent", {
        sessionId: "owned-session",
        customerType: "individual",
        consentedAt: "2026-07-28T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.verificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId_userId: { sessionId: "owned-session", userId: "member-1" } },
        create: expect.objectContaining({ sessionId: "owned-session", userId: "member-1" }),
      })
    );
  });

  it("claims an anonymous quote only when its HttpOnly browser capability matches", async () => {
    const capability = "browser-held-capability";
    mocks.cookieGet.mockReturnValue({ value: capability });
    mocks.savedQuoteFindUnique.mockResolvedValue({
      id: "quote-unowned",
      userId: null,
      customerType: "individual",
      deletedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      verificationCapabilityHash: hashVerificationCapability(capability),
    });
    mocks.savedQuoteUpdateMany.mockResolvedValue({ count: 1 });

    const response = await consent(
      request("/api/verification/consent", {
        sessionId: "owned-session",
        customerType: "individual",
        consentedAt: "2026-07-28T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.savedQuoteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "quote-unowned",
          userId: null,
          verificationCapabilityHash: hashVerificationCapability(capability),
        }),
        data: { userId: "member-1", verificationCapabilityHash: null },
      })
    );
    expect(mocks.verificationUpsert).toHaveBeenCalled();
  });

  it("blocks another member's easy-auth start before Codef is called", async () => {
    const response = await start(request("/api/verification/easyauth/start", easyAuthBody));

    expect(response.status).toBe(404);
    expect(mocks.startEasyAuth).not.toHaveBeenCalled();
  });

  it("blocks another member's easy-auth completion before Codef or document writes", async () => {
    const response = await complete(
      request("/api/verification/easyauth/complete", {
        ...easyAuthBody,
        twoWayInfo: { jobIndex: 0, threadIndex: 0, jti: "jti", twoWayTimestamp: 1 },
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.completeEasyAuth).not.toHaveBeenCalled();
    expect(mocks.documentCreate).not.toHaveBeenCalled();
    expect(mocks.documentUpdate).not.toHaveBeenCalled();
  });

  it("blocks another member's verification fetch before paid Codef calls", async () => {
    const response = await fetchVerification(
      request("/api/verification/fetch", {
        verificationId: "victim-verification",
        connectedId: "connected-id",
        name: "홍길동",
        birthDate: "19900101",
        licenseNo: "12-34-567890-12",
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.verifyDriverLicense).not.toHaveBeenCalled();
    expect(mocks.verificationUpdate).not.toHaveBeenCalled();
  });
});
