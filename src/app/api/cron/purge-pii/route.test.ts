import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  purgeVerification: vi.fn(),
  purgeDocuments: vi.fn(),
  purgeQuoteContacts: vi.fn(),
  purgeScrapeCredentials: vi.fn(),
  timingSafeEqualString: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customerVerification: { updateMany: mocks.purgeVerification },
    verificationDocument: { updateMany: mocks.purgeDocuments },
    savedQuote: { updateMany: mocks.purgeQuoteContacts },
  },
}));

vi.mock("@/lib/security", () => ({
  timingSafeEqualString: mocks.timingSafeEqualString,
}));

vi.mock("@/lib/scraper/credential-retention", () => ({
  purgeExpiredScrapeJobCredentials: mocks.purgeScrapeCredentials,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { POST } from "./route";

describe("POST /api/cron/purge-pii", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.timingSafeEqualString.mockReturnValue(true);
    mocks.purgeVerification.mockResolvedValue({ count: 2 });
    mocks.purgeDocuments.mockResolvedValue({ count: 3 });
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

  it("purges successful verification PII after 90 days and incomplete PII after 7 days", async () => {
    await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(mocks.purgeVerification).toHaveBeenCalledWith({
      where: {
        piiPurgedAt: null,
        AND: [
          {
            OR: [
              { verifiedAt: { lt: expect.any(Date) } },
              { verifiedAt: null, updatedAt: { lt: expect.any(Date) } },
            ],
          },
          {
            OR: [
              { connectedId: { not: null } },
              { licenseData: { not: expect.anything() } },
              { insuranceData: { not: expect.anything() } },
              { bizData: { not: expect.anything() } },
            ],
          },
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

    const call = mocks.purgeVerification.mock.calls[0][0];
    const successCutoff = call.where.AND[0].OR[0].verifiedAt.lt as Date;
    const incompleteCutoff = call.where.AND[0].OR[1].updatedAt.lt as Date;
    expect(successCutoff.getTime()).toBeLessThan(incompleteCutoff.getTime());
    expect(incompleteCutoff.getTime() - successCutoff.getTime()).toBe(
      83 * 24 * 60 * 60 * 1000
    );
  });

  it("purges issued document PII after 90 days and failed or pending data after 7 days", async () => {
    await POST(
      new NextRequest("https://example.com/api/cron/purge-pii", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(mocks.purgeDocuments).toHaveBeenCalledWith({
      where: {
        piiPurgedAt: null,
        AND: [
          {
            OR: [
              { issuedAt: { lt: expect.any(Date) } },
              { issuedAt: null, updatedAt: { lt: expect.any(Date) } },
            ],
          },
          {
            OR: [
              { contentEnc: { not: expect.anything() } },
              { docVerifyNo: { not: null } },
              { failReason: { not: null } },
            ],
          },
        ],
      },
      data: {
        contentEnc: expect.anything(),
        docVerifyNo: null,
        failReason: null,
        piiPurgedAt: expect.any(Date),
      },
    });
  });
});
