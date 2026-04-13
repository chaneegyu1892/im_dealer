/**
 * vehicle_specs_final.json → Vehicle.detailedSpecs 업데이트 스크립트
 * 실행: npx tsx prisma/update-vehicle-specs.ts
 */

import { PrismaClient } from "@prisma/client";
import specsData from "../vehicle_specs_final.json";

const prisma = new PrismaClient();

async function main() {
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
