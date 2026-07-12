import { describe, expect, it } from "vitest";
import { parseRecommendOverlapCli, resolveRecommendOverlapApplyMode } from "./recommend-overlap-cli";

const fingerprint = "db-fingerprint";

describe("recommend overlap bootstrap CLI", () => {
  it("defaults to a zero-write dry run", () => {
    const options = parseRecommendOverlapCli([]);
    expect(options).toEqual({ action: "dry-run", forceReset: false, confirmForceReset: null, confirmProduction: null, output: null });
    expect(resolveRecommendOverlapApplyMode(options, { target: undefined, applyFlag: undefined, expectedFingerprint: undefined }, fingerprint)).toBe("dry-run");
  });

  it("allows ordinary non-production apply only with an explicit target and flag", () => {
    const options = parseRecommendOverlapCli(["--apply"]);
    expect(resolveRecommendOverlapApplyMode(options, { target: "staging", applyFlag: "1", expectedFingerprint: undefined }, fingerprint)).toBe("ordinary");
    expect(() => resolveRecommendOverlapApplyMode(options, { target: undefined, applyFlag: "1", expectedFingerprint: undefined }, fingerprint)).toThrow(/TARGET/);
    expect(() => resolveRecommendOverlapApplyMode(options, { target: "staging", applyFlag: undefined, expectedFingerprint: undefined }, fingerprint)).toThrow(/APPLY=1/);
  });

  it("requires a separate force-reset confirmation and forbids it in production", () => {
    const missing = parseRecommendOverlapCli(["--apply", "--force-reset"]);
    expect(() => resolveRecommendOverlapApplyMode(missing, { target: "test", applyFlag: "1", expectedFingerprint: undefined }, fingerprint)).toThrow(/force reset confirmation/);
    const confirmed = parseRecommendOverlapCli(["--apply", "--force-reset", "--confirm-force-reset", "overlap-v2-force-reset"]);
    expect(resolveRecommendOverlapApplyMode(confirmed, { target: "test", applyFlag: "1", expectedFingerprint: undefined }, fingerprint)).toBe("force-reset");
    expect(() => resolveRecommendOverlapApplyMode(confirmed, { target: "production", applyFlag: "production-confirmed", expectedFingerprint: fingerprint }, fingerprint)).toThrow(/forbidden/);
  });

  it("requires all three production gates", () => {
    const options = parseRecommendOverlapCli(["--apply", "--confirm-production", "overlap-v2-51"]);
    expect(resolveRecommendOverlapApplyMode(options, { target: "production", applyFlag: "production-confirmed", expectedFingerprint: fingerprint }, fingerprint)).toBe("production");
    expect(() => resolveRecommendOverlapApplyMode(options, { target: "production", applyFlag: "1", expectedFingerprint: fingerprint }, fingerprint)).toThrow(/apply flag/);
    expect(() => resolveRecommendOverlapApplyMode(options, { target: "production", applyFlag: "production-confirmed", expectedFingerprint: "wrong" }, fingerprint)).toThrow(/fingerprint/);
  });

  it("rejects malformed and conflicting options", () => {
    expect(() => parseRecommendOverlapCli(["--wat"])).toThrow(/unknown option/);
    expect(() => parseRecommendOverlapCli(["--output"])).toThrow(/requires a value/);
    expect(() => parseRecommendOverlapCli(["--force-reset"])).toThrow(/requires --apply/);
  });
});
