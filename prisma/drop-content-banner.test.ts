import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(process.cwd(), "prisma/schema.prisma");
const SEED_PATH = resolve(process.cwd(), "prisma/seed.ts");
const MIGRATION_PATH = resolve(
  process.cwd(),
  "prisma/migrations/20260819020000_drop_content_banner/migration.sql"
);
const INIT_MIGRATION_PATH = resolve(
  process.cwd(),
  "prisma/migrations/20260404091358_init/migration.sql"
);

describe("drop orphan ContentBanner", () => {
  it("removes the model and seed upsert, and adds a new DROP TABLE migration", async () => {
    const [schema, seed, migration, initMigration] = await Promise.all([
      readFile(SCHEMA_PATH, "utf8"),
      readFile(SEED_PATH, "utf8"),
      readFile(MIGRATION_PATH, "utf8"),
      readFile(INIT_MIGRATION_PATH, "utf8"),
    ]);

    expect(schema).not.toMatch(/\bmodel\s+ContentBanner\b/);
    expect(seed).not.toMatch(/\bcontentBanner\b/);
    expect(seed).not.toMatch(/prisma\.contentBanner\.upsert/);

    const normalized = migration.replace(/\s+/g, " ").trim();
    expect(normalized).toContain('DROP TABLE IF EXISTS "ContentBanner"');

    expect(initMigration).toContain('CREATE TABLE "ContentBanner"');
  });
});
