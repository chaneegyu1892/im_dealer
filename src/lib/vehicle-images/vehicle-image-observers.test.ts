import { describe, expect, it } from "vitest";
import {
  ExpectedFailureLedger,
  isExpectedNextImageNavigationAbort,
  shouldRecordVehicleImageRequestFailure,
  unexpectedBrowserConsoleErrors,
} from "../../../e2e/fixtures/vehicle-image-observers";

describe("isExpectedNextImageNavigationAbort", () => {
  const imageUrl = "http://127.0.0.1:3000/_next/image?url=http%3A%2F%2F127.0.0.1%3A4000%2Fstorage%2Fmain.png&w=640&q=75";

  it("accepts only an aborted GET for the Next image optimizer", () => {
    expect(isExpectedNextImageNavigationAbort("GET", imageUrl, "net::ERR_ABORTED")).toBe(true);
    expect(shouldRecordVehicleImageRequestFailure("GET", imageUrl, "net::ERR_ABORTED")).toBe(false);
  });

  it("records an aborted RSC request", () => {
    const rscUrl = "http://127.0.0.1:3000/cars?_rsc=abc123";
    expect(isExpectedNextImageNavigationAbort("GET", rscUrl, "net::ERR_ABORTED")).toBe(false);
    expect(shouldRecordVehicleImageRequestFailure("GET", rscUrl, "net::ERR_ABORTED")).toBe(true);
  });

  it("consumes only browser console messages backed by an explicitly allowed response", () => {
    const badRequest = "Failed to load resource: the server responded with a status of 400 (Bad Request)";
    const conflict = "Failed to load resource: the server responded with a status of 409 (Conflict)";
    expect(unexpectedBrowserConsoleErrors([badRequest, conflict], [400, 409])).toEqual([]);
    expect(unexpectedBrowserConsoleErrors([badRequest, badRequest], [400])).toEqual([badRequest]);
    expect(unexpectedBrowserConsoleErrors(["application exploded"], [500])).toEqual(["application exploded"]);
  });

  it("allows one exact response only after the spec confirms its asserted UI state", () => {
    const ledger = new ExpectedFailureLedger();
    const token = ledger.register({ method: "POST", pathname: "/api/admin/images", status: 400 });
    expect(() => token.confirm()).toThrow("was not observed");
    expect(ledger.observe("POST", "/api/admin/images", 409)).toBe(false);
    expect(ledger.observe("POST", "/api/admin/images", 400)).toBe(true);
    expect(ledger.observe("POST", "/api/admin/images", 400)).toBe(false);
    expect(ledger.unresolved()).toHaveLength(1);
    token.confirm();
    expect(ledger.unresolved()).toEqual([]);
    expect(ledger.confirmedStatuses()).toEqual([400]);
  });

  it.each([
    ["POST", imageUrl, "net::ERR_ABORTED"],
    ["GET", "http://127.0.0.1:3000/_next/image", "net::ERR_ABORTED"],
    ["GET", "http://127.0.0.1:3000/api/admin/images?url=x", "net::ERR_ABORTED"],
    ["GET", imageUrl, "net::ERR_FAILED"],
  ])("rejects method, path, query, and failure mismatches", (method, url, errorText) => {
    expect(isExpectedNextImageNavigationAbort(method, url, errorText)).toBe(false);
    expect(shouldRecordVehicleImageRequestFailure(method, url, errorText)).toBe(true);
  });
});
