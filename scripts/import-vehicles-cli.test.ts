import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const SCRIPT = resolve(process.cwd(), "scripts/import-vehicles.ts");
const TSX_LOADER = fileURLToPath(import.meta.resolve("tsx"));

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("import-vehicles CLI", () => {
  it("preserves the existing dry-run model filter and summary output", () => {
    // Given: a minimal external vehicle file with two model ids.
    const directory = mkdtempSync(join(tmpdir(), "legacy-vehicle-import-"));
    temporaryDirectories.push(directory);
    const fixture = join(directory, "vehicles.json");
    writeFileSync(fixture, JSON.stringify({
      meta: { source: "test", brandCount: 1, modelCount: 2 },
      lookups: {},
      brands: {
        "111": {
          brandId: "111",
          name: "테스트브랜드",
          models: {
            "101": { modelId: "101", detail: { model: { "101": { name: "첫차", price: { min: 10_000_000 } } } } },
            "202": { modelId: "202", detail: { model: { "202": { name: "둘째차", price: { min: 20_000_000 } } } } },
          },
        },
      },
    }));

    // When: the real CLI runs in dry-run mode for one model.
    const result = spawnSync(
      process.execPath,
      ["--import", TSX_LOADER, SCRIPT, "--file", fixture, "--model", "202", "--dry-run"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    // Then: the filtered vehicle and established summary are observable without a DB connection.
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("외부 차량 데이터 임포트 시작 (dryRun=true");
    expect(result.stdout).toContain("[DRY] Vehicle 202 (둘째차, 테스트브랜드/세단, 20,000,000원");
    expect(result.stdout).not.toContain("[DRY] Vehicle 101");
    expect(result.stdout).toContain("처리 모델: 1");
    expect(result.stdout).toContain("에러:     0");
  });

  it("preserves the existing dry-run brand filter", () => {
    // Given: two brands whose model ids would both be eligible without filtering.
    const directory = mkdtempSync(join(tmpdir(), "legacy-vehicle-import-brand-"));
    temporaryDirectories.push(directory);
    const fixture = join(directory, "vehicles.json");
    writeFileSync(fixture, JSON.stringify({
      meta: { source: "test", brandCount: 2, modelCount: 2 },
      lookups: {},
      brands: {
        "111": {
          brandId: "111",
          name: "첫브랜드",
          models: {
            "101": { modelId: "101", detail: { model: { "101": { name: "첫차" } } } },
          },
        },
        "222": {
          brandId: "222",
          name: "둘째브랜드",
          models: {
            "202": { modelId: "202", detail: { model: { "202": { name: "둘째차" } } } },
          },
        },
      },
    }));

    // When: the real CLI selects one brand.
    const result = spawnSync(
      process.execPath,
      ["--import", TSX_LOADER, SCRIPT, "--file", fixture, "--brand", "222", "--dry-run"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    // Then: only that brand is imported and the established summary remains intact.
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[DRY] Vehicle 202 (둘째차, 둘째브랜드/세단");
    expect(result.stdout).not.toContain("[DRY] Vehicle 101");
    expect(result.stdout).toContain("처리 모델: 1");
  });

  it("preserves the existing all-files defaults and output order", () => {
    // Given: the two established --all filenames in an isolated working directory.
    const directory = mkdtempSync(join(tmpdir(), "legacy-vehicle-import-all-"));
    temporaryDirectories.push(directory);
    const buildFixture = (modelId: string, name: string) => JSON.stringify({
      meta: { source: "test", brandCount: 1, modelCount: 1 },
      lookups: {},
      brands: {
        "111": {
          brandId: "111",
          name: "테스트브랜드",
          models: {
            [modelId]: { modelId, detail: { model: { [modelId]: { name } } } },
          },
        },
      },
    });
    writeFileSync(join(directory, "raw_data_ko_car.json"), buildFixture("101", "국산차"));
    writeFileSync(join(directory, "raw_data_imported_car.json"), buildFixture("202", "수입차"));

    // When: the real CLI runs the --all dry-run path.
    const result = spawnSync(
      process.execPath,
      ["--import", TSX_LOADER, SCRIPT, "--all", "--dry-run"],
      { cwd: directory, encoding: "utf8" },
    );

    // Then: domestic precedes imported data and the aggregate output remains unchanged.
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "외부 차량 데이터 임포트 시작 (dryRun=true, files=raw_data_ko_car.json,raw_data_imported_car.json)",
    );
    const domesticIndex = result.stdout.indexOf("=== raw_data_ko_car.json (1 모델) ===");
    const importedIndex = result.stdout.indexOf("=== raw_data_imported_car.json (1 모델) ===");
    expect(domesticIndex).toBeGreaterThanOrEqual(0);
    expect(importedIndex).toBeGreaterThan(domesticIndex);
    expect(result.stdout).toContain("처리 모델: 2");
    expect(result.stdout).toContain("에러:     0");
  });
});
