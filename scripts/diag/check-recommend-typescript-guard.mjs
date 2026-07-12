import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
if (!base) throw new Error("--base <git-ref> is required");

const files = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const scoped = files.filter((file) => /^(src|prisma|scripts)\//.test(file) && /\.tsx?$/.test(file));
const exemptAssertions = new Set([
  "src/lib/recommend/recommend-legacy-v1.ts",
  "prisma/seed.ts",
]);
const locExempt = new Set([
  "prisma/recommendation-overlap-v2-data.ts",
  "prisma/seed.ts",
  "src/lib/recommend/recommend-legacy-v1.ts",
]);
const failures = [];

for (const file of scoped) {
  const patch = execFileSync("git", ["diff", "--unified=0", `${base}...HEAD`, "--", file], { encoding: "utf8" });
  const added = patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1));
  if (!exemptAssertions.has(file)) {
    for (const [index, line] of added.entries()) {
      if (/\bas unknown\b|@ts-ignore|@ts-expect-error|:\s*any\b|<any>/.test(line)) {
        failures.push(`${file}:added-${index + 1}: forbidden TypeScript escape`);
      }
      if (/\w!\.(?![=])|\w!\[/.test(line)) failures.push(`${file}:added-${index + 1}: non-null assertion`);
    }
  }
  if (!locExempt.has(file) && !/\.test\.[jt]sx?$/.test(file) && !file.startsWith("e2e/")) {
    const lines = readFileSync(file, "utf8").trimEnd().split("\n").length;
    if (lines > 250) failures.push(`${file}: ${lines} LOC exceeds 250`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ base, checkedFiles: scoped.length, passed: true }));
}
