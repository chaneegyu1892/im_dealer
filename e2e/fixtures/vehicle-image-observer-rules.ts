export type ExpectedFailure = { readonly method: string; readonly pathname: string; readonly status: number };
export type NetworkFailure = { readonly method: string; readonly url: string; readonly status: number };
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
