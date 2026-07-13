import { describe, expect, it } from "vitest";
import {
  assertDatabaseTarget,
  databaseEndpointFingerprints,
  databaseIdentityFingerprint,
  type DatabaseTargetEnvironment,
  type DatabaseUrls,
} from "./database-target-guard";

const productionUrls = {
  runtimeUrl: "postgresql://prod-runtime.example/prod",
  directUrl: "postgresql://prod-direct.example/prod",
} as const;
const testUrls = {
  runtimeUrl: "postgresql://127.0.0.1:55432/test",
  directUrl: "postgresql://127.0.0.1:55432/test",
} as const;

function endpointFingerprints(urls: DatabaseUrls): { readonly runtime: string; readonly direct: string } {
  return databaseEndpointFingerprints(urls);
}

function environment(
  urls: DatabaseUrls,
  overrides: Readonly<Record<string, string | undefined>> = {},
): DatabaseTargetEnvironment {
  const production = endpointFingerprints(productionUrls);
  const value = {
    target: "test",
    applyFlag: "1",
    expectedFingerprint: databaseIdentityFingerprint(urls),
    productionFingerprint: databaseIdentityFingerprint(productionUrls),
    productionRuntimeFingerprint: production.runtime,
    productionDirectFingerprint: production.direct,
    ...overrides,
  };
  return value;
}

function request(urls: DatabaseUrls, targetEnvironment: DatabaseTargetEnvironment) {
  return {
    action: "apply" as const,
    confirmProduction: null,
    environment: targetEnvironment,
    actualFingerprint: databaseIdentityFingerprint(urls),
    actualEndpointFingerprints: endpointFingerprints(urls),
  };
}

describe("database target guard endpoint isolation", () => {
  it.each([
    ["production runtime plus test direct", { runtimeUrl: productionUrls.runtimeUrl, directUrl: testUrls.directUrl }],
    ["test runtime plus production direct", { runtimeUrl: testUrls.runtimeUrl, directUrl: productionUrls.directUrl }],
  ])("Given %s When a test apply is requested Then the production endpoint is denied", (_label, urls) => {
    // Given
    const targetEnvironment = environment(urls);

    // When
    const action = (): unknown => assertDatabaseTarget(request(urls, targetEnvironment));

    // Then
    expect(action).toThrow(/production (runtime|direct) endpoint/i);
  });

  it.each([
    ["runtime", { productionRuntimeFingerprint: undefined }],
    ["direct", { productionDirectFingerprint: undefined }],
  ])("Given a missing production %s fingerprint When apply is requested Then it fails closed", (_label, overrides) => {
    // Given
    const targetEnvironment = environment(testUrls, overrides);

    // When
    const action = (): unknown => assertDatabaseTarget(request(testUrls, targetEnvironment));

    // Then
    expect(action).toThrow(/PRODUCTION_DATABASE_(RUNTIME|DIRECT)_FINGERPRINT/);
  });

  it("Given the production runtime and direct pair When every aggregate and endpoint gate matches Then production is allowed", () => {
    // Given
    const endpoints = endpointFingerprints(productionUrls);
    const targetEnvironment = environment(productionUrls, {
      target: "production",
      applyFlag: "production-confirmed",
    });
    const productionRequest = {
      ...request(productionUrls, targetEnvironment),
      confirmProduction: "carpan2-cover-407",
      actualEndpointFingerprints: endpoints,
    };

    // When
    const mode = assertDatabaseTarget(productionRequest);

    // Then
    expect(mode).toBe("production");
  });

  it("Given production aggregate equality but a different endpoint anchor When confirmed Then production is denied", () => {
    // Given
    const targetEnvironment = environment(productionUrls, {
      target: "production",
      applyFlag: "production-confirmed",
      productionRuntimeFingerprint: "0".repeat(64),
    });
    const productionRequest = {
      ...request(productionUrls, targetEnvironment),
      confirmProduction: "carpan2-cover-407",
    };

    // When
    const action = (): unknown => assertDatabaseTarget(productionRequest);

    // Then
    expect(action).toThrow(/production runtime endpoint/i);
  });
});
