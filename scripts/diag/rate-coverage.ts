import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('========== 1) 활성 캐피탈사별 회수율 시트 수 ==========');
  const fcs = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      fc.id, fc.name, fc."isActive",
      COUNT(crs.id)::int AS rate_sheet_count,
      COUNT(DISTINCT crs."trimId")::int AS distinct_trim_count
    FROM "FinanceCompany" fc
    LEFT JOIN "CapitalRateSheet" crs ON crs."financeCompanyId" = fc.id AND crs."isActive" = true
    GROUP BY fc.id, fc.name, fc."isActive"
    ORDER BY fc."isActive" DESC, rate_sheet_count DESC;
  `);
  console.table(fcs);

  console.log('\n========== 2) lineupId NULL인 visible 트림 ==========');
  const nullLineupTrims = await prisma.$queryRawUnsafe<any[]>(`
    SELECT v.name AS vehicle, t.name AS trim, t.id AS trim_id
    FROM "Trim" t JOIN "Vehicle" v ON v.id = t."vehicleId"
    WHERE t."lineupId" IS NULL AND t."isVisible" = true AND v."isVisible" = true
    ORDER BY v.name, t.name LIMIT 50;
  `);
  console.table(nullLineupTrims);
  console.log(`총 ${nullLineupTrims.length}건`);

  console.log('\n========== 3) 회수율 0개인 visible 트림 (견적 불가) ==========');
  const noRateTrims = await prisma.$queryRawUnsafe<any[]>(`
    SELECT v.name AS vehicle, l.name AS lineup, t.name AS trim, t.id AS trim_id
    FROM "Trim" t
    JOIN "Vehicle" v ON v.id = t."vehicleId"
    LEFT JOIN "VehicleLineup" l ON l.id = t."lineupId"
    LEFT JOIN "CapitalRateSheet" crs ON crs."trimId" = t.id AND crs."isActive" = true
      AND EXISTS (SELECT 1 FROM "FinanceCompany" fc WHERE fc.id = crs."financeCompanyId" AND fc."isActive" = true)
    WHERE t."isVisible" = true AND v."isVisible" = true
    GROUP BY v.name, l.name, t.name, t.id
    HAVING COUNT(crs.id) = 0
    ORDER BY v.name, l.name NULLS FIRST, t.name
    LIMIT 100;
  `);
  console.table(noRateTrims);
  console.log(`총 ${noRateTrims.length}건 (최대 100건 표시)`);

  console.log('\n========== 4) 차량별 트림 vs 회수율 커버리지 요약 ==========');
  const coverage = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      v.name AS vehicle,
      COUNT(DISTINCT t.id)::int AS visible_trims,
      COUNT(DISTINCT CASE WHEN t."lineupId" IS NOT NULL THEN t.id END)::int AS lineup_attached,
      COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM "CapitalRateSheet" crs
        WHERE crs."trimId" = t.id AND crs."isActive" = true
          AND EXISTS (SELECT 1 FROM "FinanceCompany" fc WHERE fc.id = crs."financeCompanyId" AND fc."isActive" = true)
      ) THEN t.id END)::int AS with_active_rate
    FROM "Vehicle" v
    LEFT JOIN "Trim" t ON t."vehicleId" = v.id AND t."isVisible" = true
    WHERE v."isVisible" = true
    GROUP BY v.name
    ORDER BY v.name;
  `);
  console.table(coverage);

  console.log('\n========== 5) 캐피탈사 커버 수가 적은 visible 트림 (≤2개) ==========');
  const lowCoverage = await prisma.$queryRawUnsafe<any[]>(`
    WITH per_trim AS (
      SELECT t.id AS trim_id, v.name AS vehicle, t.name AS trim,
             ARRAY_AGG(DISTINCT fc.name ORDER BY fc.name) FILTER (WHERE fc.id IS NOT NULL) AS finance_companies
      FROM "Trim" t
      JOIN "Vehicle" v ON v.id = t."vehicleId"
      LEFT JOIN "CapitalRateSheet" crs ON crs."trimId" = t.id AND crs."isActive" = true
      LEFT JOIN "FinanceCompany" fc ON fc.id = crs."financeCompanyId" AND fc."isActive" = true
      WHERE t."isVisible" = true AND v."isVisible" = true
      GROUP BY t.id, v.name, t.name
    )
    SELECT vehicle, trim, finance_companies,
           COALESCE(array_length(finance_companies, 1), 0) AS fc_count
    FROM per_trim
    WHERE COALESCE(array_length(finance_companies, 1), 0) <= 2
    ORDER BY fc_count, vehicle, trim
    LIMIT 30;
  `);
  console.table(lowCoverage);
  console.log(`총 ${lowCoverage.length}건 표시 (≤2개 캐피탈사 커버)`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
