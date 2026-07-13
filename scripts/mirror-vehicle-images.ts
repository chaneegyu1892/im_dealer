import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import {
  auditLegacyMirrorVehicle,
  LEGACY_MIRROR_USAGE,
  parseLegacyMirrorArgs,
} from "../src/lib/vehicle-images/legacy-writer-policy";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main(): Promise<void> {
  const options = parseLegacyMirrorArgs(process.argv.slice(2));
  if (options.helpRequested) {
    console.log(LEGACY_MIRROR_USAGE);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const where = options.vehicleId === null ? {} : { id: options.vehicleId };
    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        name: true,
        brand: true,
        thumbnailUrl: true,
        imageUrls: true,
        thumbnailImageId: true,
        imageRevision: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const audited = vehicles.map((vehicle) => ({
      vehicle,
      result: auditLegacyMirrorVehicle(vehicle, { host: options.host }),
    }));
    const candidates = audited.filter(({ result }) => result.candidates > 0);
    const target = options.limit === null
      ? candidates
      : candidates.slice(0, options.limit);

    console.log(`레거시 이미지 감사 대상: ${target.length}대`);
    console.log("이 스크립트는 감사 전용이며 Vehicle 이미지 필드를 변경하지 않습니다.");
    for (const { vehicle, result } of target) {
      console.log(
        `${vehicle.brand}/${vehicle.name} (${vehicle.id}) candidates=${result.candidates} representative=${vehicle.thumbnailImageId ?? "none"} revision=${vehicle.imageRevision}`,
      );
    }

    const candidateUrls = target.reduce(
      (count, { result }) => count + result.candidates,
      0,
    );
    console.log(`외부 URL 후보: ${candidateUrls}`);
    console.log("DB 변경: 0");
    console.log("실제 이미지 저장은 scripts/import-carpan2-vehicle-images.ts --apply 를 사용하세요.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
