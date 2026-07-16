import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: async () => ({
    admin: { id: "admin-1", email: "admin@example.com" },
    error: null,
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { scrapeJob: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));

import { PATCH } from "./route";

function request(action: "cancel" | "resume"): NextRequest {
  return new NextRequest("http://localhost/api/admin/scrape-jobs/job-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

describe("PATCH /api/admin/scrape-jobs/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not overwrite a terminal state won during cancel", async () => {
    mocks.findUnique.mockResolvedValue({ id: "job-1", status: "running" });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await PATCH(request("cancel"), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: { in: ["pending", "running", "needs_human"] } },
      data: expect.objectContaining({ status: "canceled" }),
    });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
