import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(process.cwd(), "prisma/schema.prisma");
const MIGRATION_PATH = resolve(
  process.cwd(),
  "prisma/migrations/20260716000000_add_scraper_catalog_integration/migration.sql"
);

const SCRAPE_JOB_COLUMNS = [
  "id",
  "financeCompanyId",
  "jobType",
  "status",
  "productType",
  "params",
  "credUsernameEnc",
  "credPasswordEnc",
  "draft",
  "progress",
  "error",
  "humanPrompt",
  "claimedAt",
  "heartbeatAt",
  "finishedAt",
  "createdById",
  "createdAt",
  "updatedAt",
] as const;

const CATALOG_COLUMNS = [
  "financeCompanyId",
  "productType",
  "brandCd",
  "brandName",
  "modelCd",
  "modelName",
  "dtMdlCd",
  "dtMdlName",
  "mdelCd",
  "trimName",
  "modelYear",
  "vehiclePrice",
  "baseRates",
  "depositRate36_10000",
  "prepayRate36_10000",
  "warnings",
  "weekOf",
  "scrapedAt",
] as const;

const MAPPING_COLUMNS = [
  "financeCompanyId",
  "trimId",
  "productType",
  "catalogTrimId",
  "source",
  "confidence",
  "externalMdelCd",
  "externalLabel",
  "createdById",
] as const;

function modelBlock(schema: string, modelName: string): string {
  const match = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`).exec(schema);
  expect(match, `missing Prisma model ${modelName}`).not.toBeNull();
  return match?.[0] ?? "";
}

describe("scraper catalog Prisma migration parity", () => {
  it("declares the complete relational schema", async () => {
    // Given
    const schema = await readFile(SCHEMA_PATH, "utf8");

    // When
    const scrapeJob = modelBlock(schema, "ScrapeJob");
    const catalogTrim = modelBlock(schema, "CapitalCatalogTrim");
    const trimMapping = modelBlock(schema, "CapitalTrimMapping");

    // Then
    expect(modelBlock(schema, "Vehicle")).toMatch(/\bscraperRefs\s+Json\?/);
    expect(modelBlock(schema, "FinanceCompany")).toMatch(/\bscrapeJobs\s+ScrapeJob\[\]/);
    for (const column of SCRAPE_JOB_COLUMNS) {
      expect(scrapeJob, `ScrapeJob.${column}`).toMatch(new RegExp(`\\b${column}\\s+`));
    }
    expect(scrapeJob).toMatch(
      /financeCompany\s+FinanceCompany\s+@relation\(fields: \[financeCompanyId\], references: \[id\], onDelete: Cascade\)/
    );
    for (const column of CATALOG_COLUMNS) {
      expect(catalogTrim, `CapitalCatalogTrim.${column}`).toMatch(new RegExp(`\\b${column}\\s+`));
    }
    for (const column of MAPPING_COLUMNS) {
      expect(trimMapping, `CapitalTrimMapping.${column}`).toMatch(new RegExp(`\\b${column}\\s+`));
    }
  });

  it("creates every table, column, index, and cascading foreign key", async () => {
    // Given
    const migration = await readFile(MIGRATION_PATH, "utf8");

    // When
    const normalized = migration.replace(/\s+/g, " ");

    // Then
    expect(normalized).toContain('ALTER TABLE "Vehicle" ADD COLUMN "scraperRefs" JSONB');
    for (const table of ["ScrapeJob", "CapitalCatalogTrim", "CapitalTrimMapping"]) {
      expect(normalized).toContain(`CREATE TABLE "${table}"`);
    }
    for (const column of SCRAPE_JOB_COLUMNS) {
      expect(normalized, `ScrapeJob.${column}`).toContain(`"${column}"`);
    }
    for (const column of CATALOG_COLUMNS) {
      expect(normalized, `CapitalCatalogTrim.${column}`).toContain(`"${column}"`);
    }
    for (const column of MAPPING_COLUMNS) {
      expect(normalized, `CapitalTrimMapping.${column}`).toContain(`"${column}"`);
    }

    for (const index of [
      "ScrapeJob_status_createdAt_idx",
      "ScrapeJob_financeCompanyId_status_idx",
      "CapitalCatalogTrim_financeCompanyId_productType_mdelCd_key",
      "CapitalCatalogTrim_financeCompanyId_brandCd_idx",
      "CapitalCatalogTrim_financeCompanyId_weekOf_idx",
      "CapitalTrimMapping_financeCompanyId_trimId_productType_key",
      "CapitalTrimMapping_catalogTrimId_idx",
    ]) {
      expect(normalized, index).toContain(`"${index}"`);
    }

    for (const foreignKey of [
      "ScrapeJob_financeCompanyId_fkey",
      "CapitalCatalogTrim_financeCompanyId_fkey",
      "CapitalTrimMapping_financeCompanyId_fkey",
      "CapitalTrimMapping_trimId_fkey",
      "CapitalTrimMapping_catalogTrimId_fkey",
    ]) {
      expect(normalized, foreignKey).toMatch(
        new RegExp(`CONSTRAINT "${foreignKey}"[\\s\\S]*?ON DELETE CASCADE ON UPDATE CASCADE`)
      );
    }
  });

  it("remains additive and supersedes the standalone SQL", async () => {
    // Given
    const migration = await readFile(MIGRATION_PATH, "utf8");

    // When
    const changedPaths = ["scripts/sql/20260703_capital_catalog.sql"];

    // Then
    expect(migration).not.toMatch(/^\s*(?:DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
    await expect(readFile(resolve(process.cwd(), changedPaths[0]), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
