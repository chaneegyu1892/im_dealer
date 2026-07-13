import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IMPORT_SCRIPT = resolve(process.cwd(), "scripts/import-vehicles.ts");
const MIRROR_SCRIPT = resolve(process.cwd(), "scripts/mirror-vehicle-images.ts");

describe("legacy vehicle image writer policy", () => {
  it("does not let the general vehicle importer own managed image fields", async () => {
    // Given: the executable general vehicle import script.
    const source = await readFile(IMPORT_SCRIPT, "utf8");

    // When: its Vehicle upsert path is inspected.
    const start = source.indexOf("const vehicle = await prisma.vehicle.upsert");
    const end = source.indexOf("if (existing)", start);
    const vehicleUpsert = source.slice(start, end);

    // Then: the path delegates image ownership instead of writing legacy fields directly.
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(vehicleUpsert).not.toMatch(/\bthumbnailUrl\b/);
    expect(vehicleUpsert).not.toMatch(/\bimageUrls\b/);
  });

  it("keeps the legacy mirror script audit-only", async () => {
    // Given: the executable legacy mirror script.
    const source = await readFile(MIRROR_SCRIPT, "utf8");

    // When: its persistence calls are inspected.
    // Then: it cannot directly mutate Vehicle image projections.
    expect(source).not.toContain("prisma.vehicle.update");
    expect(source).not.toContain("prisma.vehicle.upsert");
  });
});
