export interface RecommendOverlapCliOptions {
  readonly action: "dry-run" | "apply";
  readonly forceReset: boolean;
  readonly confirmForceReset: string | null;
  readonly confirmProduction: string | null;
  readonly output: string | null;
}

export interface RecommendOverlapApplyEnvironment {
  readonly target: string | undefined;
  readonly applyFlag: string | undefined;
  readonly expectedFingerprint: string | undefined;
}

export type RecommendOverlapApplyMode = "dry-run" | "ordinary" | "force-reset" | "production";

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseRecommendOverlapCli(args: readonly string[]): RecommendOverlapCliOptions {
  let action: RecommendOverlapCliOptions["action"] = "dry-run";
  let forceReset = false;
  let confirmForceReset: string | null = null;
  let confirmProduction: string | null = null;
  let output: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") action = "dry-run";
    else if (arg === "--apply") action = "apply";
    else if (arg === "--force-reset") forceReset = true;
    else if (arg === "--confirm-force-reset") {
      confirmForceReset = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--confirm-production") {
      confirmProduction = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--output") {
      output = readValue(args, index, arg);
      index += 1;
    } else throw new Error(`unknown option: ${arg}`);
  }
  if (action === "dry-run" && forceReset) throw new Error("--force-reset requires --apply");
  return { action, forceReset, confirmForceReset, confirmProduction, output };
}

export function resolveRecommendOverlapApplyMode(
  options: RecommendOverlapCliOptions,
  environment: RecommendOverlapApplyEnvironment,
  actualFingerprint: string
): RecommendOverlapApplyMode {
  if (options.action === "dry-run") return "dry-run";
  const target = environment.target;
  if (target === undefined || !["development", "test", "staging", "production"].includes(target)) {
    throw new Error("RECOMMEND_PROFILE_TARGET must be development, test, staging, or production");
  }
  if (target === "production") {
    if (options.forceReset) throw new Error("production force reset is forbidden");
    if (options.confirmProduction !== "overlap-v2-51") throw new Error("production confirmation mismatch");
    if (environment.applyFlag !== "production-confirmed") throw new Error("production apply flag mismatch");
    if (!environment.expectedFingerprint || environment.expectedFingerprint !== actualFingerprint) {
      throw new Error("production database fingerprint mismatch");
    }
    return "production";
  }
  if (options.confirmProduction !== null) throw new Error("production confirmation is forbidden for a non-production target");
  if (environment.applyFlag !== "1") throw new Error("ordinary apply requires RECOMMEND_PROFILE_APPLY=1");
  if (options.forceReset) {
    if (options.confirmForceReset !== "overlap-v2-force-reset") throw new Error("force reset confirmation mismatch");
    return "force-reset";
  }
  return "ordinary";
}
