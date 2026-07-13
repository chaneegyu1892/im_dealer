import type { ChildProcess } from "node:child_process";
import type { Server } from "node:http";

export type ReadinessFetch = (url: string, signal: AbortSignal) => Promise<{ readonly status: number }>;
type ReadinessTarget = { readonly environment: NodeJS.ProcessEnv };
type ReadinessOptions = {
  readonly fetch?: ReadinessFetch;
  readonly attemptTimeoutMs?: number;
  readonly overallTimeoutMs?: number;
  readonly retryDelayMs?: number;
};

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export async function waitForApp(target: ReadinessTarget, options: ReadinessOptions = {}): Promise<void> {
  const request = options.fetch ?? ((url, signal) => fetch(url, { signal }));
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 2_000;
  const deadline = Date.now() + (options.overallTimeoutMs ?? 60_000);
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), Math.min(attemptTimeoutMs, remaining));
    try {
      const response = await request(`${target.environment.E2E_BASE_URL}/api/vehicles`, controller.signal);
      if (response.status < 500) return;
    } catch (error: unknown) { // no-excuse-ok: catch -- readiness retries only transport and bounded abort failures.
      if (!(error instanceof TypeError) && !isAbortError(error)) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, options.retryDelayMs ?? 250));
    }
  }
  throw new Error("Next.js app did not become ready");
}

export async function stopChild(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null) return;
  await new Promise<void>((resolveStop) => {
    child.once("exit", () => resolveStop());
    child.kill("SIGTERM");
    setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 5_000).unref();
  });
}

export async function closeServer(server: Server | null): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

type CleanupDependencies = {
  readonly stopChild?: (child: ChildProcess | null) => Promise<void>;
  readonly closeServer?: (server: Server | null) => Promise<void>;
};

async function settle(step: () => void | Promise<void>): Promise<unknown | null> {
  return Promise.resolve().then(step).then(() => null, (error: unknown) => error);
}

export async function cleanupVehicleImageE2EResources(
  app: ChildProcess | null,
  storageServer: Server | null,
  cleanupHarness: () => void,
  dependencies: CleanupDependencies = {},
): Promise<void> {
  const errors: unknown[] = [];
  for (const step of [
    () => (dependencies.stopChild ?? stopChild)(app),
    () => (dependencies.closeServer ?? closeServer)(storageServer),
    cleanupHarness,
  ]) {
    const error = await settle(step);
    if (error !== null) errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, "vehicle image E2E resource cleanup failed");
}
