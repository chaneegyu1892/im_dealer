import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVerificationReviewer: vi.fn(),
  findUnique: vi.fn(),
  decrypt: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireVerificationReviewer: mocks.requireVerificationReviewer,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationDocument: { findUnique: mocks.findUnique },
  },
}));
vi.mock("@/lib/pii", () => ({ decryptDocumentContent: mocks.decrypt }));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));

import { GET } from "./route";

const actor = { id: "admin-1", email: "admin@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireVerificationReviewer.mockResolvedValue({ admin: actor, error: null });
  mocks.findUnique.mockResolvedValue({
    verificationId: "verification-1",
    contentEnc: { ciphertext: "raw-encrypted-pdf-content" },
    mimeType: "application/pdf",
    fileName: "rrn-900101-1234567.pdf",
  });
  mocks.decrypt.mockReturnValue(Buffer.from("sensitive PDF bytes").toString("base64"));
  mocks.audit.mockResolvedValue(undefined);
});

describe("GET /api/verification/documents/[docId]", () => {
  it("audits an authorized download without document content or PII", async () => {
    const request = new Request("https://example.com/api/verification/documents/document-1");

    const response = await GET(request, {
      params: Promise.resolve({ docId: "document-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith({
      request,
      actor,
      action: "VERIFICATION_DOCUMENT_DOWNLOAD",
      resource: "VerificationDocument",
      targetId: "document-1",
      meta: {
        verificationId: "verification-1",
        docId: "document-1",
      },
    });

    const auditPayload = JSON.stringify(mocks.audit.mock.calls[0]?.[0]);
    expect(auditPayload).not.toMatch(
      /contentEnc|ciphertext|PDF bytes|fileName|900101|phone|rrn|codef/i
    );
  });

  it("does not audit when authorization fails", async () => {
    mocks.requireVerificationReviewer.mockResolvedValue({
      admin: null,
      error: new Response(null, { status: 403 }),
    });

    const response = await GET(
      new Request("https://example.com/api/verification/documents/document-1"),
      { params: Promise.resolve({ docId: "document-1" }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
