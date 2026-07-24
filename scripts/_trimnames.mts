import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const nm of process.argv.slice(2)) {
  const v = await p.vehicle.findFirst({ where: { name: nm }, include: { trims: { include: { lineup: true } } } });
  if (!v) { console.log(`'${nm}' 없음`); continue; }
  console.log(`\n=== ${v.brand} / ${v.name} ===`);
  const byL: Record<string, string[]> = {};
  for (const t of v.trims) {
    const ln = t.lineup?.name ?? "(라인업없음)";
    (byL[ln] = byL[ln] || []).push(`${t.engineType}|${t.name}`);
  }
  for (const [ln, ts] of Object.entries(byL)) {
    console.log(` [${ln}] ${ts.length}건`);
    for (const t of ts.slice(0, 4)) console.log(`   - ${t}`);
  }
}
await p.$disconnect();
