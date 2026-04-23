/**
 * RateConfig → CapitalRateSheet 1회성 데이터 이전 스크립트
 *
 * 실행 순서:
 *   1. npx prisma migrate deploy   (RateConfig 드롭 + CapitalRateSheet 생성)
 *   2. npx prisma generate
 *   3. npx tsx scripts/migrate-rateconfig-to-capital.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── 구 RateConfig 시드와 동일한 로직 ─────────────────────────

type RateSheetKey =
  | "36_10000" | "36_20000" | "36_30000"
  | "48_10000" | "48_20000" | "48_30000"
  | "60_10000" | "60_20000" | "60_30000";
type RateSheetRaw = Record<RateSheetKey, number>;

function generateRateMatrix(baseRate: number): RateSheetRaw {
  const months = [36, 48, 60] as const;
  const mileages = [10000, 20000, 30000] as const;
  const monthsAdjust: Record<number, number> = {
    36: baseRate * 0.20,
    48: 0,
    60: baseRate * -0.16,
  };
  const mileageAdjust: Record<number, number> = {
    10000: baseRate * -0.05,
    20000: 0,
    30000: baseRate * 0.05,
  };

  const result = {} as RateSheetRaw;
  for (const m of months) {
    for (const mi of mileages) {
      const key = `${m}_${mi}` as RateSheetKey;
      result[key] = parseFloat((baseRate + monthsAdjust[m] + mileageAdjust[mi]).toFixed(6));
    }
  }
  return result;
}

const fcBaseRateOffset: Record<string, number> = {
  IM: 0,
  SHINHAN: 0.0003,
  BNK: 0.0002,
  ORIX: 0.0005,
};

const categoryBaseRate: Record<string, number> = {
  세단: 0.0218,
  SUV: 0.0225,
  밴: 0.0230,
  트럭: 0.0235,
};

const priceRanges: Record<string, { min: number; max: number }> = {
  low: { min: 25_000_000, max: 40_000_000 },
  mid: { min: 35_000_000, max: 55_000_000 },
  high: { min: 50_000_000, max: 80_000_000 },
};

// ORIX × SORENTO 실제 회수율 (CLAUDE.md 명세)
const ORIX_SORENTO_MIN: RateSheetRaw = {
  "36_10000": 0.012325, "36_20000": 0.013337, "36_30000": 0.013993,
  "48_10000": 0.012726, "48_20000": 0.012506, "48_30000": 0.013682,
  "60_10000": 0.012110, "60_20000": 0.012181, "60_30000": 0.012997,
};
const ORIX_SORENTO_MAX: RateSheetRaw = {
  "36_10000": 0.012634, "36_20000": 0.013695, "36_30000": 0.014395,
  "48_10000": 0.012914, "48_20000": 0.012841, "48_30000": 0.013986,
  "60_10000": 0.012236, "60_20000": 0.012406, "60_30000": 0.013126,
};

function getWeekMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function main() {
  console.log("🔄 CapitalRateSheet 데이터 이전 시작...\n");

  const weekOf = getWeekMonday();
  console.log(`  주 시작일: ${weekOf.toISOString().slice(0, 10)}`);

  const [vehicles, financeCompanies] = await Promise.all([
    prisma.vehicle.findMany({
      select: {
        id: true, vehicleCode: true, category: true, basePrice: true, slug: true,
        trims: { where: { isVisible: true }, select: { id: true, price: true } },
      },
    }),
    prisma.financeCompany.findMany({ select: { id: true, code: true } }),
  ]);

  console.log(`  차량 ${vehicles.length}개, 금융사 ${financeCompanies.length}개\n`);

  const fcIds: Record<string, string> = {};
  for (const fc of financeCompanies) fcIds[fc.code] = fc.id;

  let count = 0;
  let skipped = 0;

  for (const v of vehicles) {
    if (!v.vehicleCode || v.trims.length === 0) { skipped++; continue; }

    const priceRange = v.basePrice < 35_000_000 ? "low" : v.basePrice < 55_000_000 ? "mid" : "high";
    const range = priceRanges[priceRange];
    const baseRate = categoryBaseRate[v.category] ?? 0.0225;

    for (const [fcCode, fcId] of Object.entries(fcIds)) {
      const offset = fcBaseRateOffset[fcCode] ?? 0;
      const effectiveRate = baseRate + offset;

      const isOrixSorento = fcCode === "ORIX" && v.slug === "sorento";
      const minMatrix = isOrixSorento ? ORIX_SORENTO_MIN : generateRateMatrix(effectiveRate);
      const maxMatrix = isOrixSorento ? ORIX_SORENTO_MAX : generateRateMatrix(effectiveRate + 0.0008);

      // Trim 단위로 upsert
      for (const trim of v.trims) {
        await prisma.capitalRateSheet.upsert({
          where: {
            financeCompanyId_trimId_weekOf: {
              financeCompanyId: fcId,
              trimId: trim.id,
              weekOf,
            },
          },
          update: {
            minVehiclePrice: range.min,
            maxVehiclePrice: range.max,
            minBaseRates: {},
            minDepositRates: {},
            minPrepayRates: {},
            maxBaseRates: {},
            maxDepositRates: {},
            maxPrepayRates: {},
            minRateMatrix: minMatrix,
            maxRateMatrix: maxMatrix,
            depositDiscountRate: -0.000523,
            prepayAdjustRate: 0.000073,
            isActive: true,
          },
          create: {
            financeCompanyId: fcId,
            trimId: trim.id,
            weekOf,
            minVehiclePrice: range.min,
            maxVehiclePrice: range.max,
            minBaseRates: {},
            minDepositRates: {},
            minPrepayRates: {},
            maxBaseRates: {},
            maxDepositRates: {},
            maxPrepayRates: {},
            minRateMatrix: minMatrix,
            maxRateMatrix: maxMatrix,
            depositDiscountRate: -0.000523,
            prepayAdjustRate: 0.000073,
            isActive: true,
          },
        });
        count++;
      }
    }
  }

  console.log(`✅ ${count}개 CapitalRateSheet 생성 완료`);
  if (skipped > 0) console.log(`⚠️  vehicleCode 없음 ${skipped}개 차량 건너뜀`);
  console.log(`\n총 Trim 처리: ${vehicles.reduce((s, v) => s + v.trims.length, 0)}개`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
