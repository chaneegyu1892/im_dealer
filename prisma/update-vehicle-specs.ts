/**
 * vehicle_specs_final.json → Vehicle.detailedSpecs 업데이트 스크립트
 * 실행: npx tsx prisma/update-vehicle-specs.ts
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";
import path from "path";

const prisma = new PrismaClient();
const specsPath = path.join(process.cwd(), "vehicle_specs_final.json");

function loadSpecsData(): Record<string, unknown> {
  if (!existsSync(specsPath)) {
    throw new Error(
      `vehicle_specs_final.json 파일을 찾을 수 없습니다: ${specsPath}`
    );
  }

  const parsed: unknown = JSON.parse(readFileSync(specsPath, "utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("vehicle_specs_final.json 형식이 올바르지 않습니다.");
  }

  return parsed as Record<string, unknown>;
}

async function main() {
  const specsData = loadSpecsData();
  console.log(`총 ${Object.keys(specsData).length}개 차량 업데이트 시작...\n`);

  let successCount = 0;
  let skipCount = 0;

  for (const [slug, data] of Object.entries(specsData)) {
    const result = await prisma.vehicle.updateMany({
      where: { slug },
      data: { detailedSpecs: data as object },
    });

    if (result.count > 0) {
      console.log(`✓ ${slug}`);
      successCount++;
    } else {
      console.log(`⚠ ${slug} — DB에 해당 slug 없음 (skip)`);
      skipCount++;
    }
  }

  console.log(`\n완료: ${successCount}개 업데이트, ${skipCount}개 skip`);
}

main()
  .catch((e) => {
    console.error("오류:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
