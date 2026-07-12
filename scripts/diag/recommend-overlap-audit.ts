import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { auditOverlapSnapshot } from "../../src/lib/recommend/overlap-audit";
import { loadOverlapCandidateSnapshot } from "../../src/lib/recommend/overlap-candidate-loader";

function outputPath(args: readonly string[]): string | null {
  const index = args.indexOf("--output");
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--output requires a path");
  if (args.length !== 2) throw new Error("only --output <path> is supported");
  return value;
}

async function main(): Promise<void> {
  const path = outputPath(process.argv.slice(2));
  const snapshot = await loadOverlapCandidateSnapshot();
  const report = auditOverlapSnapshot(snapshot);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (path) {
    const absolute = resolve(path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, json, "utf8");
  }
  console.log(json.trimEnd());
  if (!report.passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : "unknown audit error" }));
  process.exitCode = 1;
});
