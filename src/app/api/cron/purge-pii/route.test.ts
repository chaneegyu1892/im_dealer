import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  purgeVerification: vi.fn(),
  deleteIncompleteVerifications: vi.fn(),
  purgeDocuments: vi.fn(),
  deleteIncompleteDocuments: vi.fn(),
  purgeQuoteContacts: vi.fn(),
  purgeScrapeCredentials: vi.fn(),
  timingSafeEqualString: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerVerification: {
      updateMany: mocks.purgeVerification,
      deleteMany: mocks.deleteIncompleteVerifications,
    },
    verificationDocument: {
      updateMany: mocks.purgeDocuments,
      deleteMany: mocks.deleteIncompleteDocuments,
    },
    savedQuote: { updateMany: mocks.purgeQuoteContacts },
  },
}));

vi.mock("@/lib/security", () => ({
  timingSafeEqualString: mocks.timingSafeEqualString,
}));

vi.mock("@/lib/scraper/credential-retention", () => ({
  purgeExpiredScrapeJobCredentials: mocks.purgeScrapeCredentials,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import { POST } from "./route";

describe("POST /api/cron/purge-pii", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.timingSafeEqualString.mockReturnValue(true);
    mocks.purgeVerification.mockResolvedValue({ count: 2 });
    mocks.deleteIncompleteVerifications.mockResolvedValue({ count: 6 });
    mocks.purgeDocuments.mockResolvedValue({ count: 3 });
    mocks.deleteIncompleteDocuments.mockResolvedValue({ count: 7 });
    mocks.purgeQuoteContacts.mockResolvedValue({ count: 4 });
    mocks.purgeScrapeCredentials.mockResolvedValue({ count: 5 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("purges contacts from deleted quotes and quotes expired beyond the retention period", async () => {
    const response = await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.purgeQuoteContacts).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { deletedAt: { not: null } },
              { expiresAt: { lt: expect.any(Date) } },
            ],
          },
          {
            OR: [
              { customerName: { not: null } },
              { phone: { not: null } },
              { verificationCapabilityHash: { not: null } },
            ],
          },
        ],
      },
      data: {
        customerName: null,
        phone: null,
        verificationCapabilityHash: null,
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      purgedQuoteContacts: 4,
      purgedScrapeJobCredentials: 5,
    });
    expect(mocks.purgeScrapeCredentials).toHaveBeenCalledWith();
  });

  it("purges successful verification PII after 90 days and deletes incomplete metadata after 7 days", async () => {
    await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(mocks.purgeVerification).toHaveBeenCalledWith({
      where: {
        verifiedAt: { lt: expect.any(Date) },
        piiPurgedAt: null,
        OR: [
          { connectedId: { not: null } },
          { licenseData: { not: expect.anything() } },
          { insuranceData: { not: expect.anything() } },
          { bizData: { not: expect.anything() } },
        ],
      },
      data: {
        connectedId: null,
        licenseData: expect.anything(),
        insuranceData: expect.anything(),
        bizData: expect.anything(),
        piiPurgedAt: expect.any(Date),
      },
    });
    expect(mocks.deleteIncompleteVerifications).toHaveBeenCalledWith({
      where: {
        verifiedAt: null,
        updatedAt: { lt: expect.any(Date) },
        documents: { none: { updatedAt: { gte: expect.any(Date) } } },
      },
    });

    const successCall = mocks.purgeVerification.mock.calls[0][0];
    const incompleteCall = mocks.deleteIncompleteVerifications.mock.calls[0][0];
    const successCutoff = successCall.where.verifiedAt.lt as Date;
    const incompleteCutoff = incompleteCall.where.updatedAt.lt as Date;
    expect(successCutoff.getTime()).toBeLessThan(incompleteCutoff.getTime());
    expect(incompleteCutoff.getTime() - successCutoff.getTime()).toBe(
      83 * 24 * 60 * 60 * 1000
    );
  });

  it("purges issued document PII after 90 days and deletes failed or pending rows after 7 days", async () => {
    await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(mocks.purgeDocuments).toHaveBeenCalledWith({
      where: {
        issuedAt: { lt: expect.any(Date) },
        piiPurgedAt: null,
        OR: [
          { contentEnc: { not: expect.anything() } },
          { docVerifyNo: { not: null } },
          { failReason: { not: null } },
        ],
      },
      data: {
        contentEnc: expect.anything(),
        docVerifyNo: null,
        failReason: null,
        piiPurgedAt: expect.any(Date),
      },
    });
    expect(mocks.deleteIncompleteDocuments).toHaveBeenCalledWith({
      where: { issuedAt: null, updatedAt: { lt: expect.any(Date) } },
    });
  });

  it("deletes stale document rows before marking PII expired (image-first ordering)", async () => {
    await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    // 문서 원본(contentEnc) 행 삭제는 불가역 작업이므로 PII 만료 마킹(updateMany)보다
    // 먼저 성공해야 한다. 마킹이 먼저 커밋된 뒤 삭제가 실패하면 "마킹됐지만 원본이
    // 남은" 부분 상태가 된다.
    const docDeleteOrder = mocks.deleteIncompleteDocuments.mock.invocationCallOrder[0];
    const verificationPurgeOrder = mocks.purgeVerification.mock.invocationCallOrder[0];
    const documentPurgeOrder = mocks.purgeDocuments.mock.invocationCallOrder[0];
    expect(docDeleteOrder).toBeLessThan(verificationPurgeOrder);
    expect(docDeleteOrder).toBeLessThan(documentPurgeOrder);
  });

  it("does not mark PII expired when the stale document deletion fails", async () => {
    mocks.deleteIncompleteDocuments.mockRejectedValueOnce(new Error("delete failed"));

    const response = await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(response.status).toBe(500);
    expect(mocks.purgeVerification).not.toHaveBeenCalled();
    expect(mocks.purgeDocuments).not.toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { cron: "purge-pii" },
    });
  });

  it("preserves cron authentication and reports purge failures", async () => {
    mocks.timingSafeEqualString.mockReturnValueOnce(false);
    const unauthorized = await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      })
    );
    expect(unauthorized.status).toBe(401);
    expect(mocks.purgeVerification).not.toHaveBeenCalled();

    mocks.timingSafeEqualString.mockReturnValue(true);
    mocks.purgeVerification.mockRejectedValueOnce(new Error("database unavailable"));
    const failed = await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    expect(failed.status).toBe(500);
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { tags: { cron: "purge-pii" } }
    );
  });
});
