import { PrismaClient } from "@prisma/client";
import {
  buildCapitalRateFingerprint,
  buildCapitalRateGroupName,
  getCapitalRateGroupColor,
} from "../src/lib/capital-rate-groups";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

type SheetRow = Awaited<ReturnType<typeof prisma.capitalRateSheet.findMany>>[number];

function groupRows(rows: SheetRow[]) {
  const map = new Map<string, SheetRow[]>();
  for (const row of rows) {
    const fingerprint = buildCapitalRateFingerprint(row as any);
    const list = map.get(fingerprint) ?? [];
    list.push(row);
    map.set(fingerprint, list);
  }
  return map;
}

async function main() {
  const rows = await prisma.capitalRateSheet.findMany({ orderBy: { createdAt: "asc" } });
  const grouped = groupRows(rows);

  console.log(`CapitalRateSheet rows: ${rows.length}`);
  console.log(`Value groups: ${grouped.size}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);

  let groupIndex = 0;
  let updatedRows = 0;

  for (const [fingerprint, sheets] of grouped.entries()) {
    const representative = sheets[0];
    const name = buildCapitalRateGroupName(groupIndex);
    const color = getCapitalRateGroupColor(groupIndex);
    console.log(
      `${name} ${fingerprint.slice(0, 10)} · ${representative.financeCompanyId} · ${representative.productType} · ${sheets.length} sheets`
    );

    if (apply) {
      const group = await (prisma as any).capitalRateGroup.upsert({
        where: { fingerprint },
        update: {
          financeCompanyId: representative.financeCompanyId,
          productType: representative.productType,
        },
        create: {
          financeCompanyId: representative.financeCompanyId,
          productType: representative.productType,
          fingerprint,
          name,
          color,
        },
      });
      const result = await (prisma as any).capitalRateSheet.updateMany({
        where: { id: { in: sheets.map((sheet) => sheet.id) } },
        data: { groupId: group.id },
      });
      updatedRows += result.count;
    }

    groupIndex += 1;
  }

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply after reviewing the grouping output.");
  } else {
    console.log(`Backfill complete. groupId updated on ${updatedRows} rows.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
