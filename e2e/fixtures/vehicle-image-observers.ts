import { existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { assertVehicleImageE2ERuntime } from "../../src/lib/vehicle-images/e2e-runtime";

export type ExpectedFailure = { readonly method: string; readonly pathname: string; readonly status: number };
type NetworkFailure = { readonly method: string; readonly url: string; readonly status: number };
type FailureEntry = ExpectedFailure & { observed: boolean; confirmed: boolean };

export class ExpectedFailureLedger {
  readonly entries: FailureEntry[] = [];

  register(expected: ExpectedFailure): { readonly confirm: () => void } {
    const entry = { ...expected, observed: false, confirmed: false };
    this.entries.push(entry);
    return { confirm: () => {
      if (!entry.observed) throw new Error("expected failure response was not observed");
      entry.confirmed = true;
    } };
  }

  observe(method: string, pathname: string, status: number): boolean {
    const entry = this.entries.find((candidate) => !candidate.observed
      && candidate.method === method && candidate.pathname === pathname && candidate.status === status);
    if (!entry) return false;
    entry.observed = true;
    return true;
  }

  confirmedStatuses(): readonly number[] {
    return this.entries.filter(({ confirmed }) => confirmed).map(({ status }) => status);
  }

  unresolved(): readonly ExpectedFailure[] {
    return this.entries.filter(({ observed, confirmed }) => !observed || !confirmed)
      .map(({ method, pathname, status }) => ({ method, pathname, status }));
  }
}

export type VehicleImageObservers = {
  readonly assertClean: () => void;
  readonly expectFailureOnce: (expected: ExpectedFailure) => { readonly confirm: () => void };
  readonly failures: readonly NetworkFailure[];
  readonly rscRequestCount: () => number;
};

export function isExpectedNextImageNavigationAbort(method: string, url: string, errorText: string): boolean {
  if (method !== "GET" || errorText !== "net::ERR_ABORTED") return false;
  const parsed = new URL(url);
  return parsed.pathname === "/_next/image" && parsed.searchParams.has("url");
}

export function shouldRecordVehicleImageRequestFailure(method: string, url: string, errorText: string): boolean {
  return !isExpectedNextImageNavigationAbort(method, url, errorText);
}

export function unexpectedBrowserConsoleErrors(
  errors: readonly string[],
  allowedResponseStatuses: readonly number[],
): readonly string[] {
  const remainingStatuses = [...allowedResponseStatuses];
  return errors.filter((message) => {
    const status = /^Failed to load resource: the server responded with a status of (\d{3}) \([^)]+\)$/.exec(message)?.[1];
    if (!status) return true;
    const index = remainingStatuses.indexOf(Number(status));
    if (index < 0) return true;
    remainingStatuses.splice(index, 1);
    return false;
  });
}

export function attachVehicleImageObservers(page: Page): VehicleImageObservers {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  const failures: NetworkFailure[] = [];
  const expectedFailures = new ExpectedFailureLedger();
  let rscRequests = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.has("_rsc")) rscRequests += 1;
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    const url = request.url();
    if (!shouldRecordVehicleImageRequestFailure(request.method(), url, errorText)) return;
    requestFailures.push(`${request.method()} ${url}: ${errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const method = response.request().method();
    const url = response.url();
    const isAllowed = expectedFailures.observe(method, new URL(url).pathname, response.status());
    if (isAllowed) return;
    else failures.push({ method, url, status: response.status() });
  });
  return {
    failures,
    expectFailureOnce: (expected) => expectedFailures.register(expected),
    rscRequestCount: () => rscRequests,
    assertClean: () => {
      expect(expectedFailures.unresolved(), "unconfirmed expected HTTP failures").toEqual([]);
      expect(unexpectedBrowserConsoleErrors(consoleErrors, expectedFailures.confirmedStatuses()), "browser console errors").toEqual([]);
      expect(pageErrors, "uncaught page errors").toEqual([]);
      expect(requestFailures, "failed browser requests").toEqual([]);
      expect(failures, "unexpected HTTP failures").toEqual([]);
    },
  };
}

const prisma = new PrismaClient();

export async function readVehicleImageStorageState(vehicleId: string) {
  const runtime = assertVehicleImageE2ERuntime(process.env);
  const images = await prisma.vehicleImage.findMany({
    where: { vehicleId },
    select: { id: true, adminStoragePath: true, deletedAt: true, isVisible: true, storageUrl: true },
    orderBy: { id: "asc" },
  });
  return images.map((image) => ({
    ...image,
    objectExists: image.adminStoragePath === null ? null : existsSync(join(runtime.storageRoot, image.adminStoragePath)),
  }));
}
