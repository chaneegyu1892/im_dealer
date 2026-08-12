import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleAtLeast: vi.fn(),
  findQuote: vi.fn(),
  findVerification: vi.fn(),
  audit: vi.fn(),
  toView: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: { findUnique: mocks.findQuote },
    customerVerification: { findFirst: mocks.findVerification },
  },
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/verification-view", () => ({
  verificationDetailWithDocumentsSelect: { id: true },
  toVerificationDetailView: mocks.toView,
}));

import { GET } from "./route";

const actor = { id: "staff-1", email: "staff@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRoleAtLeast.mockResolvedValue({ admin: actor, error: null });
  mocks.findQuote.mockResolvedValue({ userId: "member-1" });
  mocks.findVerification.mockResolvedValue({
    id: "verification-1",
    insuranceData: { phone: "010-1234-5678", rawCodef: { connectedId: "secret" } },
  });
  mocks.toView.mockReturnValue({ customerType: "individual", documents: [] });
  mocks.audit.mockResolvedValue(undefined);
});

describe("GET /api/verification/session/[sessionId]", () => {
  it("audits an authorized detail view with verification and session IDs", async () => {
    const request = new Request("https://example.com/api/verification/session/session-1");

    const response = await GET(request, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith({
      request,
      actor,
      action: "VERIFICATION_DETAIL_VIEW",
      resource: "CustomerVerification",
      targetId: "verification-1",
      meta: {
        verificationId: "verification-1",
        sessionId: "session-1",
      },
    });

    const auditPayload = JSON.stringify(mocks.audit.mock.calls[0]?.[0]);
    expect(auditPayload).not.toMatch(/insuranceData|phone|rawCodef|connectedId|010-1234/i);
  });

  it("does not audit when authorization fails", async () => {
    mocks.requireRoleAtLeast.mockResolvedValue({
      admin: null,
      error: new Response(null, { status: 401 }),
    });

    const response = await GET(
      new Request("https://example.com/api/verification/session/session-1"),
      { params: Promise.resolve({ sessionId: "session-1" }) }
    );

    expect(response.status).toBe(401);
    expect(mocks.findQuote).not.toHaveBeenCalled();
    expect(mocks.findVerification).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
