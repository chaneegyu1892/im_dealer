import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(process.cwd(), "prisma/schema.prisma");
const MIGRATION_PATH = resolve(
  process.cwd(),
  "prisma/migrations/20260728030000_add_scrape_credential_expiry/migration.sql"
);

describe("scrape credential expiry migration", () => {
  it("declares and migrates the expiry timestamp and lookup index", async () => {
    const [schema, migration] = await Promise.all([
      readFile(SCHEMA_PATH, "utf8"),
      readFile(MIGRATION_PATH, "utf8"),
    ]);
    const normalized = migration.replace(/\s+/g, " ");

    expect(schema).toMatch(/credentialExpiresAt\s+DateTime\?/);
    expect(schema).toMatch(/@@index\(\[status, credentialExpiresAt\]\)/);
    expect(normalized).toContain(
      'ALTER TABLE "ScrapeJob" ADD COLUMN "credentialExpiresAt" TIMESTAMP(3)'
    );
    expect(normalized).toContain(
      'SET "credentialExpiresAt" = "createdAt" + INTERVAL \'24 hours\''
    );
    expect(normalized).toContain('CREATE INDEX "ScrapeJob_status_credentialExpiresAt_idx"');
  });
});
