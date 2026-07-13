import { describe, expect, it, vi } from "vitest";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "./lib/database-target-guard";

const prismaState = vi.hoisted(() => ({ constructions: 0 }));

vi.mock("@prisma/client", () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  PrismaClient: class {
    constructor() {
      prismaState.constructions += 1;
    }
  },
}));

const productionUrls = {
  runtimeUrl: "postgresql://prod-runtime.example/prod",
  directUrl: "postgresql://prod-direct.example/prod",
} as const;
const testUrls = {
  runtimeUrl: "postgresql://127.0.0.1:55432/test",
  directUrl: "postgresql://127.0.0.1:55432/test",
} as const;

describe("COVER backfill module guard", () => {
  it("Given an unsafe mixed target When the CLI module loads and apply starts Then Prisma is never constructed", async () => {
    // Given
    const productionEndpoints = databaseEndpointFingerprints(productionUrls);
    const mixedUrls = { runtimeUrl: productionUrls.runtimeUrl, directUrl: testUrls.directUrl };
    const environment = {
      DATABASE_URL: mixedUrls.runtimeUrl,
      DIRECT_URL: mixedUrls.directUrl,
      CARPAN2_COVER_TARGET: "test",
      CARPAN2_COVER_APPLY: "1",
      CARPAN2_COVER_EXPECTED_FINGERPRINT: databaseIdentityFingerprint(mixedUrls),
      PRODUCTION_DATABASE_FINGERPRINT: databaseIdentityFingerprint(productionUrls),
      PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
      PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
    };

    // When
    const { runCoverBackfillCli } = await import("./backfill-carpan2-cover-thumbnails");
    const action = runCoverBackfillCli({ argv: ["--apply"], environment });

    // Then
    await expect(action).rejects.toThrow(/production database endpoint/i);
    expect(prismaState.constructions).toBe(0);
  });
});
