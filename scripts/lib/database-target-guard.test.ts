import { describe, expect, it } from "vitest";
import {
  assertDatabaseTarget,
  databaseEndpointFingerprints,
  databaseIdentity,
  databaseIdentityFingerprint,
  type DatabaseTargetEnvironment,
} from "./database-target-guard";

const runtime = "postgresql://user:secret@LOCALHOST/app%2Dtest?sslmode=require";
const direct = "postgres://other:hidden@localhost:5544/app%2Dtest?schema=public";

function environment(overrides: Partial<DatabaseTargetEnvironment> = {}): DatabaseTargetEnvironment {
  const productionUrls = {
    runtimeUrl: "postgresql://production-runtime.invalid/production",
    directUrl: "postgresql://production-direct.invalid/production",
  };
  const productionEndpoints = databaseEndpointFingerprints(productionUrls);
  return {
    target: "test",
    applyFlag: "1",
    expectedFingerprint: databaseIdentityFingerprint({ runtimeUrl: runtime, directUrl: direct }),
    productionFingerprint: databaseIdentityFingerprint(productionUrls),
    productionRuntimeFingerprint: productionEndpoints.runtime,
    productionDirectFingerprint: productionEndpoints.direct,
    ...overrides,
  };
}

describe("database target guard", () => {
  it("Given credentialed queried URLs When identity is serialized Then only canonical ordered endpoints remain", () => {
    // Given / When
    const identity = databaseIdentity({ runtimeUrl: runtime, directUrl: direct });

    // Then
    expect(identity).toEqual({
      runtime: { host: "localhost", port: 5432, database: "app-test" },
      direct: { host: "localhost", port: 5544, database: "app-test" },
    });
    expect(JSON.stringify(identity)).not.toMatch(/user|secret|other|hidden|sslmode|schema/);
  });

  it("Given equivalent default-port URLs When fingerprinted Then credentials and queries do not change identity", () => {
    // Given
    const first = databaseIdentityFingerprint({ runtimeUrl: runtime, directUrl: direct });

    // When
    const second = databaseIdentityFingerprint({
      runtimeUrl: "postgres://x:y@localhost:5432/app-test?x=1",
      directUrl: "postgresql://x:y@LOCALHOST:5544/app-test?x=2",
    });

    // Then
    expect(second).toBe(first);
  });

  it("Given a different DIRECT_URL database When fingerprinted Then the dual-URL identity changes", () => {
    // Given
    const first = databaseIdentityFingerprint({ runtimeUrl: runtime, directUrl: direct });

    // When
    const changed = databaseIdentityFingerprint({
      runtimeUrl: runtime,
      directUrl: "postgresql://other:hidden@localhost:5544/another-database",
    });

    // Then
    expect(changed).not.toBe(first);
  });

  it.each([
    ["malformed runtime", { runtimeUrl: "not-a-url", directUrl: direct }],
    ["non-postgres runtime", { runtimeUrl: "https://localhost/database", directUrl: direct }],
    ["missing database", { runtimeUrl: "postgresql://localhost", directUrl: direct }],
    ["decoded control character", { runtimeUrl: "postgresql://localhost/app%00test", directUrl: direct }],
    ["invalid identifier", { runtimeUrl: "postgresql://localhost/app%20test", directUrl: direct }],
    ["path-like identifier", { runtimeUrl: "postgresql://localhost/app%2Ftest", directUrl: direct }],
  ])("Given %s When identity is parsed Then it fails closed", (_label, urls) => {
    // Given / When
    const action = (): unknown => databaseIdentity(urls);

    // Then
    expect(action).toThrow();
  });

  it.each([
    ["missing target", { target: undefined }, /TARGET/],
    ["wrong apply flag", { applyFlag: "production-confirmed" }, /APPLY=1/],
    ["missing expected fingerprint", { expectedFingerprint: undefined }, /EXPECTED_FINGERPRINT/],
    ["wrong expected fingerprint", { expectedFingerprint: "0".repeat(64) }, /expected fingerprint mismatch/],
    ["missing production fingerprint", { productionFingerprint: undefined }, /PRODUCTION_DATABASE_FINGERPRINT/],
    ["forbidden confirmation", {}, /confirmation is forbidden/],
  ])("Given non-production apply When %s Then it fails closed", (_label, overrides, expected) => {
    // Given
    const confirmation = _label === "forbidden confirmation" ? "carpan2-cover-407" : null;

    // When
    const action = (): unknown => assertDatabaseTarget({
      action: "apply",
      confirmProduction: confirmation,
      environment: environment(overrides),
      actualFingerprint: databaseIdentityFingerprint({ runtimeUrl: runtime, directUrl: direct }),
      actualEndpointFingerprints: databaseEndpointFingerprints({ runtimeUrl: runtime, directUrl: direct }),
    });

    // Then
    expect(action).toThrow(expected);
  });

  it("Given a fake test label pointing at production When apply is requested Then identity denial wins", () => {
    // Given
    const actual = databaseIdentityFingerprint({ runtimeUrl: runtime, directUrl: direct });

    // When
    const action = (): unknown => assertDatabaseTarget({
      action: "apply",
      confirmProduction: null,
      environment: environment({ productionFingerprint: actual }),
      actualFingerprint: actual,
      actualEndpointFingerprints: databaseEndpointFingerprints({ runtimeUrl: runtime, directUrl: direct }),
    });

    // Then
    expect(action).toThrow(/matches production/);
  });

  it("Given production identity When every independent gate matches Then production apply is allowed", () => {
    // Given
    const actual = databaseIdentityFingerprint({ runtimeUrl: runtime, directUrl: direct });

    // When
    const mode = assertDatabaseTarget({
      action: "apply",
      confirmProduction: "carpan2-cover-407",
      environment: environment({
        target: "production",
        applyFlag: "production-confirmed",
        productionFingerprint: actual,
        productionRuntimeFingerprint: databaseEndpointFingerprints({ runtimeUrl: runtime, directUrl: direct }).runtime,
        productionDirectFingerprint: databaseEndpointFingerprints({ runtimeUrl: runtime, directUrl: direct }).direct,
      }),
      actualFingerprint: actual,
      actualEndpointFingerprints: databaseEndpointFingerprints({ runtimeUrl: runtime, directUrl: direct }),
    });

    // Then
    expect(mode).toBe("production");
  });

  it.each([
    ["wrong confirmation", { confirmation: "wrong", applyFlag: "production-confirmed", expected: actualFingerprint(), production: actualFingerprint() }, /confirmation/],
    ["wrong apply flag", { confirmation: "carpan2-cover-407", applyFlag: "1", expected: actualFingerprint(), production: actualFingerprint() }, /apply flag/],
    ["wrong expected", { confirmation: "carpan2-cover-407", applyFlag: "production-confirmed", expected: "0".repeat(64), production: actualFingerprint() }, /expected fingerprint/],
    ["wrong production identity", { confirmation: "carpan2-cover-407", applyFlag: "production-confirmed", expected: actualFingerprint(), production: "0".repeat(64) }, /production identity/],
  ])("Given production target with %s When apply is checked Then it fails closed", (_label, gate, expected) => {
    // Given
    const actual = actualFingerprint();

    // When
    const action = (): unknown => assertDatabaseTarget({
      action: "apply",
      confirmProduction: gate.confirmation,
      environment: environment({
        target: "production",
        applyFlag: gate.applyFlag,
        expectedFingerprint: gate.expected,
        productionFingerprint: gate.production,
      }),
      actualFingerprint: actual,
      actualEndpointFingerprints: databaseEndpointFingerprints({ runtimeUrl: runtime, directUrl: direct }),
    });

    // Then
    expect(action).toThrow(expected);
  });

  it("Given dry-run When apply environment is absent Then no mutation gate is required", () => {
    // Given / When
    const mode = assertDatabaseTarget({
      action: "dry-run",
      confirmProduction: null,
      environment: {
        target: undefined,
        applyFlag: undefined,
        expectedFingerprint: undefined,
        productionFingerprint: undefined,
        productionRuntimeFingerprint: undefined,
        productionDirectFingerprint: undefined,
      },
      actualFingerprint: "a".repeat(64),
      actualEndpointFingerprints: { runtime: "b".repeat(64), direct: "c".repeat(64) },
    });

    // Then
    expect(mode).toBe("dry-run");
  });
});

function actualFingerprint(): string {
  return databaseIdentityFingerprint({ runtimeUrl: runtime, directUrl: direct });
}
