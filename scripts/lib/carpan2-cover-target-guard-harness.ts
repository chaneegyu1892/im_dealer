import { probeHarnessCommand } from "./carpan2-cover-harness";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "./database-target-guard";

type TargetGuardHarnessRequest = {
  readonly root: string;
  readonly cli: string;
  readonly testUrl: string;
  readonly productionUrl: string;
  readonly environment: NodeJS.ProcessEnv;
};

export class BackfillTargetGuardHarnessError extends Error {
  readonly name = "BackfillTargetGuardHarnessError";
}

function withoutEnvironmentKey(environment: NodeJS.ProcessEnv, name: string): NodeJS.ProcessEnv {
  const copy = { ...environment };
  delete copy[name];
  return copy;
}

function requireDenied(request: TargetGuardHarnessRequest, environment: NodeJS.ProcessEnv, expected: RegExp): void {
  const result = probeHarnessCommand(
    request.root,
    process.execPath,
    ["--import", "tsx", request.cli, "--apply"],
    environment,
  );
  if (result.status === 0 || !expected.test(result.stderr)) {
    throw new BackfillTargetGuardHarnessError("backfill target guard probe did not fail with the expected redacted error");
  }
}

export function verifyBackfillTargetGuard(request: TargetGuardHarnessRequest): void {
  const testUrls = { runtimeUrl: request.testUrl, directUrl: request.testUrl };
  const productionUrls = { runtimeUrl: request.productionUrl, directUrl: request.productionUrl };
  const productionEndpoints = databaseEndpointFingerprints(productionUrls);
  const productionEnvironment = {
    ...request.environment,
    DATABASE_URL: testUrls.runtimeUrl,
    DIRECT_URL: testUrls.directUrl,
    CARPAN2_COVER_EXPECTED_FINGERPRINT: databaseIdentityFingerprint(testUrls),
    PRODUCTION_DATABASE_FINGERPRINT: databaseIdentityFingerprint(productionUrls),
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
  };
  for (const urls of [
    { runtimeUrl: request.productionUrl, directUrl: request.testUrl },
    { runtimeUrl: request.testUrl, directUrl: request.productionUrl },
  ]) {
    requireDenied(request, {
      ...productionEnvironment,
      DATABASE_URL: urls.runtimeUrl,
      DIRECT_URL: urls.directUrl,
      CARPAN2_COVER_EXPECTED_FINGERPRINT: databaseIdentityFingerprint(urls),
    }, /production database endpoint/i);
  }
  requireDenied(request, withoutEnvironmentKey(
    productionEnvironment,
    "PRODUCTION_DATABASE_RUNTIME_FINGERPRINT",
  ), /PRODUCTION_DATABASE_RUNTIME_FINGERPRINT/);
  requireDenied(request, withoutEnvironmentKey(
    productionEnvironment,
    "PRODUCTION_DATABASE_DIRECT_FINGERPRINT",
  ), /PRODUCTION_DATABASE_DIRECT_FINGERPRINT/);
}
