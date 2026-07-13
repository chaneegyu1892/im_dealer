import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertVehicleImageE2ERuntime } from "../../src/lib/vehicle-images/e2e-runtime";
import type { AdminVehicleImageFixture } from "./admin-vehicle-images";

const prisma = new PrismaClient();

export async function seedForcedFailureVehicle(
  fixture: AdminVehicleImageFixture,
  png: Uint8Array,
): Promise<void> {
  const runtime = assertVehicleImageE2ERuntime(process.env);
  const objectDir = join(runtime.storageRoot, fixture.prefix);
  await mkdir(objectDir, { recursive: true });
  await writeFile(join(objectDir, "cover.png"), png);
  await prisma.user.create({ data: { id: `${fixture.prefix}-admin`, email: `${fixture.prefix}@e2e.invalid`, name: "E2E 강제실패 관리자", role: "admin", isActive: true } });
  await prisma.vehicle.create({ data: {
    id: fixture.vehicleId, slug: fixture.slug, name: "E2E 강제실패 차량", brand: "E2E", category: "SUV", basePrice: 40_000_000,
    thumbnailUrl: fixture.coverUrl, imageUrls: [fixture.coverUrl], tags: ["E2E"], isVisible: true,
  } });
  await prisma.vehicleImage.create({ data: {
    id: fixture.coverId, vehicleId: fixture.vehicleId, type: "COVER", origin: "CARPAN2", title: "강제실패 표지",
    storageUrl: fixture.coverUrl, sourceUrl: "https://source.invalid/forced-cover", sourceKey: `${fixture.prefix}:cover`, displayOrder: 0,
  } });
  await prisma.vehicle.update({ where: { id: fixture.vehicleId }, data: { thumbnailImageId: fixture.coverId } });
}
