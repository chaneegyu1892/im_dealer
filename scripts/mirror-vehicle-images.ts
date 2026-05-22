/**
 * 차량 이미지 일괄 미러링 스크립트
 *
 * DB의 모든 vehicle.thumbnailUrl / vehicle.imageUrls 를 순회하며 외부 URL을
 * Supabase Storage `vehicle-images` 버킷으로 복제하고, DB의 URL을 새 공개 URL로 갱신한다.
 *
 * 사용법:
 *   pnpm tsx scripts/mirror-vehicle-images.ts                 # 전체 미러링
 *   pnpm tsx scripts/mirror-vehicle-images.ts --dry-run       # 다운로드만, DB 갱신 안 함
 *   pnpm tsx scripts/mirror-vehicle-images.ts --vehicle <id>  # 특정 차량만
 *   pnpm tsx scripts/mirror-vehicle-images.ts --retry-failed  # 외부 호스트만 다시 시도
 *
 * 멱등성: 같은 콘텐츠는 SHA-256 해시 기반으로 동일 키에 저장되므로 재실행 안전.
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { mirrorImage, type MirrorContext } from "../src/lib/vehicle-image-mirror";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

interface CliOptions {
  dryRun: boolean;
  vehicleId?: string;
  retryFailedOnly: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, retryFailedOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--retry-failed") opts.retryFailedOnly = true;
    else if (a === "--vehicle") opts.vehicleId = argv[++i];
  }
  return opts;
}

interface VehicleFailure {
  vehicleId: string;
  vehicleName: string;
  originalUrl: string;
  field: "thumbnailUrl" | "imageUrls";
  error: string;
}

interface Stats {
  vehiclesProcessed: number;
  vehiclesUpdated: number;
  imagesUploaded: number;
  imagesSkipped: number;
  imagesAlreadyMirrored: number;
  failures: VehicleFailure[];
}

function isAlreadyMirrored(url: string): boolean {
  return /\/storage\/v1\/object\/public\/vehicle-images\//.test(url);
}

function isLocalOrData(url: string): boolean {
  return !url || url.startsWith("/") || url.startsWith("data:");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const prisma = new PrismaClient();

  const ctx: MirrorContext = { supabase, cache: new Map<string, string>() };

  const stats: Stats = {
    vehiclesProcessed: 0,
    vehiclesUpdated: 0,
    imagesUploaded: 0,
    imagesSkipped: 0,
    imagesAlreadyMirrored: 0,
    failures: [],
  };

  const where = opts.vehicleId ? { id: opts.vehicleId } : {};
  const vehicles = await prisma.vehicle.findMany({
    where,
    select: { id: true, name: true, brand: true, thumbnailUrl: true, imageUrls: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`▶ 미러링 대상 차량 ${vehicles.length}대 (dry-run=${opts.dryRun})\n`);

  for (const v of vehicles) {
    stats.vehiclesProcessed++;
    const label = `[${stats.vehiclesProcessed}/${vehicles.length}] ${v.brand}/${v.name}`;

    let newThumb = v.thumbnailUrl;
    const newImages: string[] = [];
    let changed = false;

    // thumbnailUrl
    if (v.thumbnailUrl && !isLocalOrData(v.thumbnailUrl)) {
      if (isAlreadyMirrored(v.thumbnailUrl)) {
        stats.imagesAlreadyMirrored++;
      } else {
        try {
          const r = await mirrorImage(v.thumbnailUrl, ctx);
          if (r.url !== v.thumbnailUrl) {
            newThumb = r.url;
            changed = true;
          }
          if (r.uploaded) stats.imagesUploaded++;
          else stats.imagesSkipped++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          stats.failures.push({
            vehicleId: v.id,
            vehicleName: `${v.brand}/${v.name}`,
            originalUrl: v.thumbnailUrl,
            field: "thumbnailUrl",
            error: msg,
          });
          console.warn(`  ⚠ ${label} thumb 실패: ${msg} (${v.thumbnailUrl.slice(0, 80)})`);
        }
      }
    } else if (v.thumbnailUrl) {
      stats.imagesSkipped++; // local/data
    }

    // imageUrls
    const existingUrls = Array.isArray(v.imageUrls) ? v.imageUrls : [];
    for (const u of existingUrls) {
      const original = String(u ?? "").trim();
      if (!original) continue;

      if (isLocalOrData(original)) {
        newImages.push(original);
        stats.imagesSkipped++;
        continue;
      }
      if (isAlreadyMirrored(original)) {
        newImages.push(original);
        stats.imagesAlreadyMirrored++;
        continue;
      }
      try {
        const r = await mirrorImage(original, ctx);
        if (r.url) newImages.push(r.url);
        if (r.url !== original) changed = true;
        if (r.uploaded) stats.imagesUploaded++;
        else stats.imagesSkipped++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.failures.push({
          vehicleId: v.id,
          vehicleName: `${v.brand}/${v.name}`,
          originalUrl: original,
          field: "imageUrls",
          error: msg,
        });
        console.warn(`  ⚠ ${label} img 실패: ${msg} (${original.slice(0, 80)})`);
        // 실패한 URL은 새 배열에서 제외 — 사용자 요청대로 "에러 생기는 이미지 없이"
      }
    }

    // 배열 변경 감지 (요소 추가/제거 모두)
    if (newImages.length !== existingUrls.length) changed = true;
    else {
      for (let i = 0; i < newImages.length; i++) {
        if (newImages[i] !== existingUrls[i]) {
          changed = true;
          break;
        }
      }
    }

    if (changed && !opts.dryRun) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { thumbnailUrl: newThumb, imageUrls: newImages },
      });
      stats.vehiclesUpdated++;
      console.log(`  ✔ ${label} 갱신 (thumb=${newThumb ? "✓" : "—"}, imgs=${newImages.length})`);
    } else if (changed) {
      console.log(`  · ${label} [dry-run] 갱신 예정 (thumb=${newThumb ? "✓" : "—"}, imgs=${newImages.length})`);
    }
  }

  console.log("\n────── 미러링 결과 ──────");
  console.log(`차량 처리:       ${stats.vehiclesProcessed}`);
  console.log(`차량 갱신:       ${stats.vehiclesUpdated}`);
  console.log(`이미지 업로드:   ${stats.imagesUploaded}`);
  console.log(`이미지 캐시 적중: ${stats.imagesSkipped}`);
  console.log(`기존 미러링:     ${stats.imagesAlreadyMirrored}`);
  console.log(`실패:           ${stats.failures.length}`);

  if (stats.failures.length > 0) {
    console.log("\n실패 목록:");
    for (const f of stats.failures) {
      console.log(`  - ${f.vehicleName} [${f.field}] ${f.error}`);
      console.log(`    ${f.originalUrl}`);
    }
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
