import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

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

function mockRole(role: "dealer" | "staff") {
  const admin = role === "dealer" ? dealerUser : staffUser;
  const error = role === "dealer"
    ? NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    : null;

  vi.doMock("@/lib/admin-auth", () => ({
    getAdminSession: vi.fn().mockResolvedValue(admin),
  }));
  vi.doMock("@/lib/require-admin", () => ({
    requireRoleAtLeast: vi.fn().mockResolvedValue({ admin: error ? null : admin, error }),
  }));
}

describe("verification API staff authorization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks dealers from decrypted verification detail before querying", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "verification-1" });
    mockRole("dealer");
    vi.doMock("@/lib/prisma", () => ({ prisma: { customerVerification: { findUnique } } }));
    vi.doMock("@/lib/pii", () => ({ decryptVerificationRow: vi.fn() }));

    const { GET } = await import("@/app/api/verification/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "verification-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("allows staff to retrieve decrypted verification detail", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "verification-1" });
    const decryptVerificationRow = vi.fn().mockReturnValue({ id: "verification-1", name: "홍길동" });
    mockRole("staff");
    vi.doMock("@/lib/prisma", () => ({ prisma: { customerVerification: { findUnique } } }));
    vi.doMock("@/lib/pii", () => ({ decryptVerificationRow }));

    const { GET } = await import("@/app/api/verification/[id]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ id: "verification-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: "verification-1", name: "홍길동" } });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "verification-1" } });
  });

  it("blocks dealers from session verification data before querying", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "verification-1" });
    mockRole("dealer");
    vi.doMock("@/lib/prisma", () => ({ prisma: { customerVerification: { findFirst } } }));
    vi.doMock("@/lib/pii", () => ({ decryptVerificationRow: vi.fn() }));

    const { GET } = await import("@/app/api/verification/session/[sessionId]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("allows staff to retrieve session verification data", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "verification-1", documents: [] });
    const decryptVerificationRow = vi.fn().mockReturnValue({ id: "verification-1", name: "홍길동" });
    mockRole("staff");
    vi.doMock("@/lib/prisma", () => ({ prisma: { customerVerification: { findFirst } } }));
    vi.doMock("@/lib/pii", () => ({ decryptVerificationRow }));

    const { GET } = await import("@/app/api/verification/session/[sessionId]/route");
    const response = await GET(new Request("https://example.com"), {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: "verification-1", name: "홍길동" } });
    expect(findFirst).toHaveBeenCalledOnce();
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
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("allows staff to download original verification PDFs", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "document-1",
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
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "document-1" } });
  });
});
