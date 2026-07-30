import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const db = p as any;
const FC = "cmnk4eoqq0007dr2tbg3azlcc";
const BRAND_CD: Record<string, string> = { "현대": "CA100001", "기아": "CA100002", "제네시스": "CA100088" };

const v = await p.vehicle.findFirst({ where: { name: "그랜저" }, include: { lineups: true, trims: true } });
if (!v) { console.log("그랜저 없음"); process.exit(0); }
const trims = v.trims.filter((t) => t.lineupId);
const job = await db.scrapeJob.create({
  data: {
    financeCompanyId: FC, status: "pending", productType: "장기렌트",
    params: {
      trimIds: trims.map((t) => t.id), vehicleId: v.id, lineupIds: v.lineups.map((l) => l.id),
      weekOf: "2026-06-15", minVehiclePrice: 0, maxVehiclePrice: 0,
      scraperRef: { brandCd: BRAND_CD[v.brand], modelName: v.name },
      trims: trims.map((t) => ({ trimId: t.id, name: t.name })),
    },
    createdById: "verify-script",
  },
});
console.log(`전체검증 잡 생성: ${job.id} (${trims.length}트림) — 처리 대기...`);

let done = null;
for (let i = 0; i < 200; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const j = await db.scrapeJob.findUnique({ where: { id: job.id } });
  if (j.status === "completed" || j.status === "failed") { done = j; break; }
}
if (!done) { console.log("시간초과"); process.exit(0); }

const dts = done.draft?.trims || [];
const lineupOf = new Map((await p.trim.findMany({ where: { id: { in: dts.map((t: any) => t.trimId) } }, include: { lineup: true } })).map((t) => [t.id, t.lineup?.name ?? "?"]));
const by: Record<string, { matched: number; nonzero: number }> = {};
for (const t of dts) {
  const ln = lineupOf.get(t.trimId) ?? "?";
  by[ln] = by[ln] || { matched: 0, nonzero: 0 };
  if (t.baseRates && t.vehiclePrice > 0) { by[ln].matched++; if ((t.baseRates["36_20000"] ?? 0) > 0) by[ln].nonzero++; }
}
console.log("상태:", done.status);
console.log("라인업별 [매칭 / 월납입금>0]:");
for (const [ln, x] of Object.entries(by)) console.log(`  ${ln}: ${x.matched} / ${x.nonzero}`);
await p.$disconnect();
