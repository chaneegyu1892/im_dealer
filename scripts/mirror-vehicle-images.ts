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
  host?: string;
  limit?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, retryFailedOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--retry-failed") opts.retryFailedOnly = true;
    else if (a === "--vehicle") {
      opts.vehicleId = readArgValue(argv, i, a);
      i++;
    } else if (a === "--host") {
      opts.host = readArgValue(argv, i, a);
      i++;
    } else if (a === "--limit") {
      opts.limit = parsePositiveInt(readArgValue(argv, i, a), a);
      i++;
    }
  }
  return opts;
}

function readArgValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return parsed;
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
  imagesWouldMirror: number;
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

function matchesHost(url: string, host: string | undefined): boolean {
  if (!host) return true;
  try {
    return new URL(url).hostname === host;
  } catch {
    return false;
  }
}

function shouldMirrorUrl(url: string, opts: CliOptions): boolean {
  return !isLocalOrData(url) && !isAlreadyMirrored(url) && matchesHost(url, opts.host);
}

function vehicleHasMirrorCandidate(
  vehicle: { thumbnailUrl: string | null; imageUrls: readonly string[] },
  opts: CliOptions,
): boolean {
  if (vehicle.thumbnailUrl && shouldMirrorUrl(vehicle.thumbnailUrl, opts)) return true;
  return vehicle.imageUrls.some((url) => shouldMirrorUrl(url, opts));
}

function createMirrorContext(): MirrorContext {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  return { supabase, cache: new Map<string, string>() };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const prisma = new PrismaClient();
  const ctx = opts.dryRun ? null : createMirrorContext();

  const stats: Stats = {
    vehiclesProcessed: 0,
    vehiclesUpdated: 0,
    imagesUploaded: 0,
    imagesWouldMirror: 0,
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
  const targetVehicles = opts.limit
    ? vehicles.filter((vehicle) => vehicleHasMirrorCandidate(vehicle, opts)).slice(0, opts.limit)
    : vehicles;

  console.log(
    `▶ 미러링 대상 차량 ${targetVehicles.length}대 (dry-run=${opts.dryRun}, host=${opts.host ?? "all"}, limit=${opts.limit ?? "all"})\n`,
  );

  for (const v of targetVehicles) {
    stats.vehiclesProcessed++;
    const label = `[${stats.vehiclesProcessed}/${targetVehicles.length}] ${v.brand}/${v.name}`;

    let newThumb = v.thumbnailUrl;
    const newImages: string[] = [];
    let changed = false;
    let wouldChange = false;

    // thumbnailUrl
    if (v.thumbnailUrl && !isLocalOrData(v.thumbnailUrl)) {
      if (isAlreadyMirrored(v.thumbnailUrl)) {
        stats.imagesAlreadyMirrored++;
      } else if (!matchesHost(v.thumbnailUrl, opts.host)) {
        stats.imagesSkipped++;
      } else if (opts.dryRun) {
        stats.imagesWouldMirror++;
        wouldChange = true;
      } else {
        try {
          if (!ctx) throw new Error("Mirror context missing");
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
      if (!matchesHost(original, opts.host)) {
        newImages.push(original);
        stats.imagesSkipped++;
        continue;
      }
      if (opts.dryRun) {
        newImages.push(original);
        stats.imagesWouldMirror++;
        wouldChange = true;
        continue;
      }
      try {
        if (!ctx) throw new Error("Mirror context missing");
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
        newImages.push(original);
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
    } else if (changed || wouldChange) {
      console.log(`  · ${label} [dry-run] 미러링 예정 (thumb=${newThumb ? "✓" : "—"}, imgs=${newImages.length})`);
    }
  }

  console.log("\n────── 미러링 결과 ──────");
  console.log(`차량 처리:       ${stats.vehiclesProcessed}`);
  console.log(`차량 갱신:       ${stats.vehiclesUpdated}`);
  console.log(`이미지 업로드:   ${stats.imagesUploaded}`);
  console.log(`미러링 예정:     ${stats.imagesWouldMirror}`);
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
