import { z } from "zod";
import {
  disconnectVehicleImageFixtureDatabase,
  seedVehicleImageFixture,
} from "../e2e/fixtures/admin-vehicle-images";

const PrefixSchema = z.string().regex(/^vi-e2e-[A-Za-z0-9-]+$/);

async function main(): Promise<void> {
  const prefix = PrefixSchema.parse(process.env.VEHICLE_IMAGE_E2E_PREFIX);
  try {
    await seedVehicleImageFixture(prefix);
  } finally {
    await disconnectVehicleImageFixtureDatabase();
  }
}

main().catch((error: unknown) => { // no-excuse-ok: catch -- fixture seeding boundary fails before build.
  process.stderr.write(`${error instanceof Error ? error.message : "unknown fixture seed failure"}\n`);
  process.exitCode = 1;
});
