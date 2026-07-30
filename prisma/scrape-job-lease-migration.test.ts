import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(process.cwd(), "prisma/schema.prisma");
const MIGRATION_PATH = resolve(
  process.cwd(),
  "prisma/migrations/20260728050000_add_scrape_job_lease_token/migration.sql"
);

describe("scrape job lease token migration", () => {
  it("adds the nullable unique fencing token to schema and SQL", async () => {
    const [schema, migration] = await Promise.all([
      readFile(SCHEMA_PATH, "utf8"),
      readFile(MIGRATION_PATH, "utf8"),
    ]);

    expect(schema).toMatch(/\bleaseToken\s+String\?\s+@unique/);
    expect(migration.replace(/\s+/g, " ")).toContain(
      'ALTER TABLE "ScrapeJob" ADD COLUMN "leaseToken" TEXT'
    );
    expect(migration).toContain('CREATE UNIQUE INDEX "ScrapeJob_leaseToken_key"');
    expect(migration).not.toMatch(/^\s*(?:DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
  });
});
