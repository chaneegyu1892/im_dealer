import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  applyProfileBootstrapChanges,
  buildProfileBootstrapReport,
  getRecommendationDatabaseFingerprint,
  loadProfileBootstrapState,
  planProfileBootstrapChanges,
  writeProfileBootstrapSnapshot,
} from "../prisma/recommendation-overlap-v2-bootstrap";
import {
  parseRecommendOverlapCli,
  resolveRecommendOverlapApplyMode,
} from "./lib/recommend-overlap-cli";

async function writeJson(path: string, value: unknown): Promise<void> {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const options = parseRecommendOverlapCli(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const fingerprint = getRecommendationDatabaseFingerprint(databaseUrl);
  const mode = resolveRecommendOverlapApplyMode(options, {
    target: process.env.RECOMMEND_PROFILE_TARGET,
    applyFlag: process.env.RECOMMEND_PROFILE_APPLY,
    expectedFingerprint: process.env.RECOMMEND_PROFILE_DB_FINGERPRINT,
  }, fingerprint);
  const prisma = new PrismaClient();

  try {
    const { catalog, vehicles } = await loadProfileBootstrapState(prisma);
    const changes = planProfileBootstrapChanges(catalog, vehicles, mode === "force-reset");
    const rows = buildProfileBootstrapReport(catalog, vehicles, changes);
    const counts = Object.fromEntries(["create", "migrate", "preserve", "reset"].map((action) => [
      action,
      changes.filter((change) => change.action === action).length,
    ]));
    let snapshotPath: string | null = null;
    let writes = 0;

    if (mode !== "dry-run") {
      const timestamp = new Date().toISOString().replaceAll(":", "-");
      snapshotPath = `.omo/evidence/ai-recommend-overlap-scoring/task-6-bootstrap/snapshots/${timestamp}-${fingerprint.slice(0, 12)}.json`;
      await writeProfileBootstrapSnapshot(snapshotPath, fingerprint, vehicles);
      writes = await applyProfileBootstrapChanges(prisma, changes);
    }

    const report = {
      version: "overlap-v2-bootstrap-report",
      mode,
      databaseFingerprint: fingerprint,
      catalogCount: catalog.length,
      resolvedCount: vehicles.length,
      counts,
      writes,
      snapshotPath,
      vehicles: rows,
    };
    if (options.output) await writeJson(options.output, report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown bootstrap error";
  console.error(JSON.stringify({ error: message }));
  process.exitCode = 1;
});
