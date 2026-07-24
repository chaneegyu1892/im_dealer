import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const MAP = ["현대", "기아", "제네시스", "쉐보레", "르노", "르노코리아", "KGM"];
const vs = await p.vehicle.findMany({
  include: { lineups: true, _count: { select: { trims: true } } },
  orderBy: [{ brand: "asc" }, { name: "asc" }],
});
for (const v of vs) {
  const refs = v.scraperRefs as Record<string, { brandCd: string; modelName: string }> | null;
  const orixRef = refs?.ORIX;
  const eligible = !!orixRef || MAP.includes(v.brand);
  console.log(`${eligible ? "✓" : " "} ${v.brand} / ${v.name}  trims=${v._count.trims} lineups=${v.lineups.length}${orixRef ? ` [override ${orixRef.modelName}]` : ""}`);
}
await p.$disconnect();
