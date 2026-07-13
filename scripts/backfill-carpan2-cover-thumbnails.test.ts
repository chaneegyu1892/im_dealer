import { describe, expect, it, vi } from "vitest";
import {
  assertBackfillReadback,
  parseCoverBackfillArgs,
  resolveCoverBackfillExecution,
  runCoverBackfillCli,
} from "./backfill-carpan2-cover-thumbnails";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "./lib/database-target-guard";
import {
  assertPostgresCleanupState,
  assertFirstApplyReceipt,
  CoverBackfillHarnessReportSchema,
} from "./lib/carpan2-cover-harness";

const urls = {
  runtimeUrl: "postgresql://runtime:secret@127.0.0.1:5544/cover_fixture?sslmode=disable",
  directUrl: "postgresql://direct:secret@127.0.0.1:5544/cover_fixture?schema=public",
} as const;
const actual = databaseIdentityFingerprint(urls);
const productionUrls = {
  runtimeUrl: "postgresql://production-runtime.invalid/production",
  directUrl: "postgresql://production-direct.invalid/production",
} as const;
const productionEndpoints = databaseEndpointFingerprints(productionUrls);

function environment(
  overrides: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string | undefined>> {
  return {
    DATABASE_URL: urls.runtimeUrl,
    DIRECT_URL: urls.directUrl,
    CARPAN2_COVER_TARGET: "test",
    CARPAN2_COVER_APPLY: "1",
    CARPAN2_COVER_EXPECTED_FINGERPRINT: actual,
    PRODUCTION_DATABASE_FINGERPRINT: databaseIdentityFingerprint(productionUrls),
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
    ...overrides,
  };
}

describe("COVER backfill CLI", () => {
  it("Given no arguments When parsed Then the CLI defaults to dry-run", () => {
    // Given / When
    const options = parseCoverBackfillArgs([]);

    // Then
    expect(options).toEqual({ action: "dry-run", confirmProduction: null, output: null });
  });

  it.each([
    [["--wat"], /unknown option/],
    [["--output"], /requires a value/],
    [["--confirm-production"], /requires a value/],
    [["--dry-run", "--apply"], /exactly one/],
    [["--dry-run", "--confirm-production", "carpan2-cover-407"], /requires --apply/],
  ])("Given malformed arguments %j When parsed Then execution is rejected", (args, expected) => {
    // Given / When
    const action = (): unknown => parseCoverBackfillArgs(args);

    // Then
    expect(action).toThrow(expected);
  });

  it("Given credentialed URLs When execution is resolved Then output contains only redacted identities", () => {
    // Given
    const options = parseCoverBackfillArgs(["--apply"]);

    // When
    const execution = resolveCoverBackfillExecution(options, environment());

    // Then
    expect(execution).toMatchObject({ guardMode: "test", target: "test", actualFingerprint: actual });
    expect(JSON.stringify(execution.identity)).not.toMatch(/secret|sslmode|schema/);
  });

  it("Given a fake test target with production identity When CLI apply starts Then guard rejects before DB creation", async () => {
    // Given
    const createClient = vi.fn(() => { throw new Error("unexpected database creation"); });

    // When
    const action = runCoverBackfillCli({
      argv: ["--apply"],
      environment: environment({ PRODUCTION_DATABASE_FINGERPRINT: actual }),
      createClient,
    });

    // Then
    await expect(action).rejects.toThrow(/matches production/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("Given missing dual URLs When CLI starts Then it fails before DB creation", async () => {
    // Given
    const createClient = vi.fn(() => { throw new Error("unexpected database creation"); });

    // When
    const action = runCoverBackfillCli({ argv: [], environment: {}, createClient });

    // Then
    await expect(action).rejects.toThrow(/DATABASE_URL/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("Given apply readback with remaining invalid projections When asserted Then CLI fails closed", () => {
    // Given
    const readback = { checked: 2, migrationRequired: 1, samples: [{ id: "vehicle-1", name: "Vehicle One" }] };

    // When
    const action = (): unknown => assertBackfillReadback(readback);

    // Then
    expect(action).toThrow(/migration-required projections remain: 1/);
  });

  it.each([0, 3])("Given expected pre-cleanup status %s When cleanup is verified Then it accepts absent process and listener", (beforeStatus) => {
    // Given
    const state = { beforeStatus, afterStatus: 3, readinessStatus: 2, postmasterAlive: false };

    // When
    const action = (): unknown => assertPostgresCleanupState(state);

    // Then
    expect(action).not.toThrow();
  });

  it.each([
    ["pg_ctl command error", { beforeStatus: 127, afterStatus: 3, readinessStatus: 2, postmasterAlive: false }],
    ["pg_ctl still running", { beforeStatus: 0, afterStatus: 0, readinessStatus: 2, postmasterAlive: false }],
    ["listener remains", { beforeStatus: 0, afterStatus: 3, readinessStatus: 0, postmasterAlive: false }],
    ["postmaster remains", { beforeStatus: 0, afterStatus: 3, readinessStatus: 2, postmasterAlive: true }],
  ])("Given %s When cleanup is verified Then it fails closed", (_label, state) => {
    // Given / When
    const action = (): unknown => assertPostgresCleanupState(state);

    // Then
    expect(action).toThrow();
  });

  it("Given a composed apply report When parsed by the harness Then action and guard modes remain exact", () => {
    // Given
    const report = {
      guardMode: "test",
      target: "test",
      identity: {
        runtime: { host: "127.0.0.1", port: 5544, database: "cover_fixture" },
        direct: { host: "127.0.0.1", port: 5544, database: "cover_fixture" },
      },
      actualFingerprint: actual,
      version: "carpan2-cover-backfill-v1",
      mode: "apply",
      counts: {
        vehicles: 1,
        plannedCreates: 0,
        plannedVehicleUpdates: 1,
        missingCandidates: 0,
        blockedLegacyUrls: 0,
        invalidCandidates: 0,
        migrationRequired: 0,
        writes: 1,
      },
      changedSamples: [{ id: "vehicle-1", name: "Vehicle One" }],
      preservedCustom: [],
      readback: { checked: 1, migrationRequired: 0, samples: [] },
    };

    // When
    const parsed = CoverBackfillHarnessReportSchema.parse(report);

    // Then
    expect(parsed).toMatchObject({ guardMode: "test", mode: "apply" });
  });

  it.each([9, 11])("Given first apply writes %s When receipt is asserted Then exact count mismatch fails", (writes) => {
    // Given
    const receipt = { writes, invalidCandidates: 3, blockedLegacyUrls: 2, migrationRequired: 0 };

    // When
    const action = (): unknown => assertFirstApplyReceipt(receipt);

    // Then
    expect(action).toThrow(/expected exactly 10 first-apply writes/);
  });
});
