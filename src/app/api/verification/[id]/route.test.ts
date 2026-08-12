import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleAtLeast: vi.fn(),
  findUnique: vi.fn(),
  audit: vi.fn(),
  toView: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerVerification: { findUnique: mocks.findUnique },
  },
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));
vi.mock("@/lib/verification-view", () => ({
  verificationDetailSelect: { id: true },
  toVerificationDetailView: mocks.toView,
}));

import { GET } from "./route";

const actor = { id: "staff-1", email: "staff@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRoleAtLeast.mockResolvedValue({ admin: actor, error: null });
  mocks.findUnique.mockResolvedValue({
    licenseData: { phone: "010-1234-5678", rrn: "900101-1234567" },
  });
  mocks.toView.mockReturnValue({ customerType: "individual" });
  mocks.audit.mockResolvedValue(undefined);
});

describe("GET /api/verification/[id]", () => {
  it("audits an authorized detail view with identifiers only", async () => {
    const request = new Request("https://example.com/api/verification/verification-1", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: "verification-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith({
      request,
      actor,
      action: "VERIFICATION_DETAIL_VIEW",
      resource: "CustomerVerification",
      targetId: "verification-1",
      meta: { verificationId: "verification-1" },
    });

    const auditPayload = JSON.stringify(mocks.audit.mock.calls[0]?.[0]);
    expect(auditPayload).not.toMatch(/licenseData|phone|rrn|900101|010-1234/i);
  });

  it("does not audit when authorization fails", async () => {
    mocks.requireRoleAtLeast.mockResolvedValue({
      admin: null,
      error: new Response(null, { status: 403 }),
    });

    const response = await GET(
      new Request("https://example.com/api/verification/verification-1"),
      { params: Promise.resolve({ id: "verification-1" }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
