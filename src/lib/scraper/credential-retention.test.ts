import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { scrapeJob: { updateMany: mocks.updateMany } },
}));

import {
  buildScrapeCredentialPurgeWhere,
  getScrapeCredentialExpiry,
  purgeExpiredScrapeJobCredentials,
  SCRAPE_CREDENTIAL_RETENTION_MS,
  SCRAPE_JOB_STALE_HEARTBEAT_MS,
} from "./credential-retention";

describe("scrape credential retention", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets a 24-hour expiry at job creation time", () => {
    const now = new Date("2026-07-28T00:00:00.000Z");

    expect(getScrapeCredentialExpiry(now)).toEqual(
      new Date(now.getTime() + SCRAPE_CREDENTIAL_RETENTION_MS)
    );
  });

  it("targets expired inactive or stale claimed jobs", () => {
    const now = new Date("2026-07-29T00:00:00.000Z");
    const staleCutoff = new Date(now.getTime() - SCRAPE_JOB_STALE_HEARTBEAT_MS);

    expect(buildScrapeCredentialPurgeWhere(now)).toEqual({
      credentialExpiresAt: { lte: now },
      AND: [
        {
          OR: [
            { credUsernameEnc: { not: null } },
            { credPasswordEnc: { not: null } },
          ],
        },
      ],
      OR: [
        { status: { in: ["pending", "completed", "failed", "canceled"] } },
        {
          status: { in: ["running", "needs_human"] },
          OR: [
            { heartbeatAt: null },
            { heartbeatAt: { lt: staleCutoff } },
          ],
        },
      ],
    });
  });

  it("purges only ciphertext and preserves the job audit row", async () => {
    mocks.updateMany.mockResolvedValue({ count: 2 });
    const now = new Date("2026-07-29T00:00:00.000Z");

    await expect(purgeExpiredScrapeJobCredentials(now)).resolves.toEqual({ count: 2 });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: buildScrapeCredentialPurgeWhere(now),
      data: {
        credUsernameEnc: null,
        credPasswordEnc: null,
      },
    });
  });
});
