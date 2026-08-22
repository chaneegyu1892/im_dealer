import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { adminAuditLog: { create: mocks.create } },
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
}));

import {
  logAdminAction,
  VEHICLE_IMAGE_AUDIT_ACTIONS,
  VERIFICATION_AUDIT_ACTIONS,
} from "./audit";
import { hashIp } from "@/lib/ip-hash";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({});
  process.env.IP_HASH_SALT = "audit-test-salt";
});

afterEach(() => {
  delete process.env.TRUST_PROXY;
  delete process.env.IP_HASH_SALT;
});

describe("vehicle image audit actions", () => {
  it("publishes the eight exact mutation actions", () => {
    expect(VEHICLE_IMAGE_AUDIT_ACTIONS).toEqual([
      "VEHICLE_IMAGE_CREATE",
      "VEHICLE_IMAGE_UPDATE",
      "VEHICLE_IMAGE_VISIBILITY",
      "VEHICLE_IMAGE_REORDER",
      "VEHICLE_IMAGE_SET_REPRESENTATIVE",
      "VEHICLE_IMAGE_DELETE",
      "VEHICLE_IMAGE_RESTORE",
      "VEHICLE_IMAGE_PURGE",
    ]);
  });
});

describe("verification audit actions", () => {
  it("publishes detail-view and document-download actions", () => {
    expect(VERIFICATION_AUDIT_ACTIONS).toEqual([
      "VERIFICATION_DETAIL_VIEW",
      "VERIFICATION_DOCUMENT_DOWNLOAD",
    ]);
  });

  it("stores actor, action, identifiers, and trusted request IP", async () => {
    process.env.TRUST_PROXY = "true";
    const request = new Request("https://example.com/api/verification/verification-1", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "audit-test",
      },
    });

    await logAdminAction({
      request,
      actor: { id: "staff-1", email: "staff@example.com" },
      action: "VERIFICATION_DETAIL_VIEW",
      resource: "CustomerVerification",
      targetId: "verification-1",
      meta: { verificationId: "verification-1" },
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        actorId: "staff-1",
        actorEmail: "staff@example.com",
        action: "VERIFICATION_DETAIL_VIEW",
        resource: "CustomerVerification",
        targetId: "verification-1",
        diff: { meta: { verificationId: "verification-1" } },
        ip: hashIp("203.0.113.10"),
        userAgent: "audit-test",
      },
    });
  });
});
