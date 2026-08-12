import { beforeEach, describe, expect, it, vi } from "vitest";
const dealerUser = {
  id: "dealer-1",
  supabaseId: "supabase-dealer-1",
  email: "dealer@example.com",
  name: "딜러",
  phone: null,
  role: "dealer",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const staffUser = { ...dealerUser, id: "staff-1", email: "staff@example.com", role: "staff" };
const adminUser = { ...dealerUser, id: "admin-1", email: "admin@example.com", role: "admin" };
const superadminUser = {
  ...dealerUser,
  id: "superadmin-1",
  email: "superadmin@example.com",
  role: "superadmin",
};

function mockRole(role: "dealer" | "staff" | "admin" | "superadmin") {
  const users = { dealer: dealerUser, staff: staffUser, admin: adminUser, superadmin: superadminUser };

  vi.doMock("@/lib/admin-auth", () => ({
    getAdminSession: vi.fn().mockResolvedValue(users[role]),
  }));
  vi.doMock("@/lib/audit", () => ({
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  }));
}

describe("verification API reviewer authorization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("keeps the metadata-only verification queue available to staff", async () => {
    const getRecentVerifications = vi.fn().mockResolvedValue([]);
    mockRole("staff");
    vi.doMock("@/lib/admin-queries", () => ({ getRecentVerifications }));

    const { GET } = await import("@/app/api/admin/verifications/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: [] });
    expect(getRecentVerifications).toHaveBeenCalledWith(50);
  });

  it("blocks dealers from decrypted verification detail before querying", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "verification-1" });
    mockRole("dealer");
    vi.doMock("@/lib/prisma", () => ({ prisma: { customerVerification: { findUnique } } }));

    const { GET } = await import("@/app/api/verification/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "verification-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "인증 상세 열람 권한이 없습니다." });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns only allowlisted verification detail fields to staff", async () => {
    const consentedAt = new Date("2026-08-01T01:00:00.000Z");
    const verifiedAt = new Date("2026-08-01T01:05:00.000Z");
    const findUnique = vi.fn().mockResolvedValue({
      customerType: "individual",
      licenseVerified: true,
      insuranceVerified: true,
      bizVerified: false,
      licenseData: {
        resAuthenticityDesc: "정상면허",
        resUserNm: "홍길동",
        licenseNo: "11-22-333333-44",
      },
      insuranceData: {
        resCompanyNm: "표시할 직장",
        resRegistrationNo: "900101-1234567",
      },
      bizData: null,
      consentedAt,
      verifiedAt,
      connectedId: "must-not-leak",
      userId: "must-not-leak",
    });
    mockRole("staff");
    vi.doMock("@/lib/prisma", () => ({ prisma: { customerVerification: { findUnique } } }));

    const { GET } = await import("@/app/api/verification/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "verification-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        customerType: "individual",
        licenseVerified: true,
        insuranceVerified: true,
        bizVerified: false,
        licenseStatus: "정상면허",
        insuranceWorkplace: "표시할 직장",
        bizStatus: null,
        consentedAt: consentedAt.toISOString(),
        verifiedAt: verifiedAt.toISOString(),
      },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "verification-1" },
      select: expect.not.objectContaining({
        connectedId: expect.anything(),
        userId: expect.anything(),
      }),
    });
  });

  it("blocks dealers from session verification data before querying", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "verification-1" });
    const findQuote = vi.fn().mockResolvedValue({ userId: "member-1" });
    mockRole("dealer");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        customerVerification: { findFirst },
        savedQuote: { findUnique: findQuote },
      },
    }));

    const { GET } = await import("@/app/api/verification/session/[sessionId]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "인증 상세 열람 권한이 없습니다." });
    expect(findFirst).not.toHaveBeenCalled();
    expect(findQuote).not.toHaveBeenCalled();
  });

  it("returns only UI fields and safe document metadata to staff", async () => {
    const consentedAt = new Date("2026-08-01T01:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      customerType: "self_employed",
      licenseVerified: true,
      insuranceVerified: false,
      bizVerified: true,
      licenseData: { resAuthenticityDesc: "정상면허", rawLicense: "must-not-leak" },
      insuranceData: { resCompanyNm: "표시할 직장", history: ["must-not-leak"] },
      bizData: {
        resBusinessStatus: "01",
        resBusinessStatusDesc: "계속사업자",
        bizNo: "123-45-67890",
      },
      consentedAt,
      verifiedAt: null,
      connectedId: "must-not-leak",
      documents: [
        {
          id: "document-1",
          docType: "biz_registration_proof",
          status: "failed",
          failReason: "발급 실패",
          fileName: "secret.pdf",
          contentEnc: { v: 1, iv: "iv", tag: "tag", ct: "ciphertext" },
          docVerifyNo: "encrypted-document-number",
        },
      ],
    });
    const findQuote = vi.fn().mockResolvedValue({ userId: "member-1" });
    mockRole("staff");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        customerVerification: { findFirst },
        savedQuote: { findUnique: findQuote },
      },
    }));

    const { GET } = await import("@/app/api/verification/session/[sessionId]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        customerType: "self_employed",
        licenseVerified: true,
        insuranceVerified: false,
        bizVerified: true,
        licenseStatus: "정상면허",
        insuranceWorkplace: "표시할 직장",
        bizStatus: "계속사업자",
        consentedAt: consentedAt.toISOString(),
        verifiedAt: null,
        documents: [
          {
            id: "document-1",
            docType: "biz_registration_proof",
            status: "failed",
            failReason: "발급 실패",
          },
        ],
      },
    });
    expect(findQuote).toHaveBeenCalledWith({
      where: { sessionId: "session-1" },
      select: { userId: true },
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { sessionId: "session-1", userId: "member-1" },
      select: expect.not.objectContaining({
        connectedId: expect.anything(),
        userId: expect.anything(),
      }),
    }));
  });

  it("does not let an ownerless legacy verification shadow a quote session", async () => {
    const findFirst = vi.fn();
    const findQuote = vi.fn().mockResolvedValue({ userId: null });
    mockRole("admin");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        customerVerification: { findFirst },
        savedQuote: { findUnique: findQuote },
      },
    }));

    const { GET } = await import("@/app/api/verification/session/[sessionId]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("blocks dealers from original verification PDFs before querying", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "document-1", contentEnc: "ciphertext" });
    mockRole("dealer");
    vi.doMock("@/lib/prisma", () => ({ prisma: { verificationDocument: { findUnique } } }));
    vi.doMock("@/lib/pii", () => ({ decryptDocumentContent: vi.fn() }));

    const { GET } = await import("@/app/api/verification/documents/[docId]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ docId: "document-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "인증 상세 열람 권한이 없습니다." });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("allows staff to download original verification PDFs", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "document-1",
      verificationId: "verification-1",
      contentEnc: "ciphertext",
      mimeType: "application/pdf",
      fileName: "income-proof.pdf",
    });
    const decryptDocumentContent = vi.fn().mockReturnValue("cGRm");
    mockRole("staff");
    vi.doMock("@/lib/prisma", () => ({ prisma: { verificationDocument: { findUnique } } }));
    vi.doMock("@/lib/pii", () => ({ decryptDocumentContent }));

    const { GET } = await import("@/app/api/verification/documents/[docId]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ docId: "document-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("pdf");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "document-1" },
      select: {
        verificationId: true,
        contentEnc: true,
        mimeType: true,
        fileName: true,
      },
    });
  });
});
