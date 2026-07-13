import { describe, expect, it, vi } from "vitest";
import { runCoverBackfillCli } from "./backfill-carpan2-cover-thumbnails";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "./lib/database-target-guard";

const productionUrls = {
  runtimeUrl: "postgresql://prod-runtime.example/prod",
  directUrl: "postgresql://prod-direct.example/prod",
} as const;
const testUrls = {
  runtimeUrl: "postgresql://127.0.0.1:55432/test",
  directUrl: "postgresql://127.0.0.1:55432/test",
} as const;

function environment(
  urls: { readonly runtimeUrl: string; readonly directUrl: string },
  overrides: Readonly<Record<string, string | undefined>> = {},
): NodeJS.ProcessEnv {
  const productionEndpoints = databaseEndpointFingerprints(productionUrls);
  return {
    NODE_ENV: "test",
    DATABASE_URL: urls.runtimeUrl,
    DIRECT_URL: urls.directUrl,
    CARPAN2_COVER_TARGET: "test",
    CARPAN2_COVER_APPLY: "1",
    CARPAN2_COVER_EXPECTED_FINGERPRINT: databaseIdentityFingerprint(urls),
    PRODUCTION_DATABASE_FINGERPRINT: databaseIdentityFingerprint(productionUrls),
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
    ...overrides,
  };
}

describe("COVER backfill endpoint guard", () => {
  it.each([
    ["runtime", { PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: undefined }],
    ["direct", { PRODUCTION_DATABASE_DIRECT_FINGERPRINT: undefined }],
  ])("Given the production %s fingerprint is missing When apply starts Then Prisma is never created", async (_label, overrides) => {
    // Given
    const createClient = vi.fn(() => { throw new Error("unexpected Prisma creation"); });

    // When
    const action = runCoverBackfillCli({ argv: ["--apply"], environment: environment(testUrls, overrides), createClient });

    // Then
    await expect(action).rejects.toThrow(/PRODUCTION_DATABASE_(RUNTIME|DIRECT)_FINGERPRINT/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["production runtime", { runtimeUrl: productionUrls.runtimeUrl, directUrl: testUrls.directUrl }],
    ["production direct", { runtimeUrl: testUrls.runtimeUrl, directUrl: productionUrls.directUrl }],
  ])("Given a mixed pair containing the %s When apply starts Then Prisma is never created", async (_label, urls) => {
    // Given
    const createClient = vi.fn(() => { throw new Error("unexpected Prisma creation"); });

    // When
    const action = runCoverBackfillCli({ argv: ["--apply"], environment: environment(urls), createClient });

    // Then
    await expect(action).rejects.toThrow(/production database endpoint/i);
    expect(createClient).not.toHaveBeenCalled();
  });
});
