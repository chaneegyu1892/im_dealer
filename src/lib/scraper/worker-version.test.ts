import { describe, expect, it } from "vitest";
import { WORKER_PROTOCOL_VERSION } from "./worker-version";

describe("worker protocol version", () => {
  it("is bumped when claim requests start requiring the protocol header", () => {
    expect(WORKER_PROTOCOL_VERSION).toBe(3);
  });
});
