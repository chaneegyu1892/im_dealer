import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const db = p as any;
const FC = "cmnk4eoqq0007dr2tbg3azlcc";
// route.ts 와 동일한 브랜드코드 맵
const ORIX_BRAND_CD: Record<string, string> = {
  "현대": "CA100001", "기아": "CA100002", "제네시스": "CA100088",
  "쉐보레": "CA100045", "르노": "CA100004", "르노코리아": "CA100004", "KGM": "CA100005",
};

const NAME = process.argv[2];
const LIMIT = Number(process.argv[3] ?? 0);
if (!NAME) { console.log("usage: tsx _verifyvehicle.mts <vehicleName> [limit]"); process.exit(1); }

const v = await p.vehicle.findFirst({ where: { name: NAME }, include: { lineups: true, trims: { include: { lineup: true } } } });
if (!v) { console.log(`'${NAME}' 없음`); process.exit(0); }

// route.ts deriveScraperRef 와 동일: scraperRefs override 우선, 없으면 브랜드+차량명
const refs = v.scraperRefs as Record<string, { brandCd: string; modelName: string }> | null;
const scraperRef = refs?.ORIX ?? (ORIX_BRAND_CD[v.brand] ? { brandCd: ORIX_BRAND_CD[v.brand], modelName: v.name } : undefined);
if (!scraperRef) { console.log(`ORIX 식별 불가 (brand=${v.brand}, scraperRefs 없음)`); process.exit(0); }

let trims = v.trims.filter((t) => t.lineupId);
if (LIMIT > 0) trims = trims.slice(0, LIMIT);

const job = await db.scrapeJob.create({
  data: {
    financeCompanyId: FC, status: "pending", productType: "장기렌트",
    params: {
      trimIds: trims.map((t) => t.id), vehicleId: v.id, lineupIds: v.lineups.map((l) => l.id),
      weekOf: "2026-06-15", minVehiclePrice: 0, maxVehiclePrice: 0,
      scraperRef, trims: trims.map((t) => ({ trimId: t.id, name: t.name })),
    },
    createdById: "verify-script",
  },
});
console.log(`검증 잡: ${v.brand} ${v.name} (${trims.length}트림) ref=${JSON.stringify(scraperRef)}`);
console.log(`job=${job.id} — 처리 대기...`);

let done = null;
for (let i = 0; i < 400; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const j = await db.scrapeJob.findUnique({ where: { id: job.id } });
  if (j.status === "completed" || j.status === "failed") { done = j; break; }
}
if (!done) { console.log("시간초과"); process.exit(0); }

const dts = done.draft?.trims || [];
const lineupOf = new Map((await p.trim.findMany({ where: { id: { in: dts.map((t: any) => t.trimId) } }, include: { lineup: true } })).map((t) => [t.id, t.lineup?.name ?? "?"]));
const by: Record<string, { total: number; matched: number; nonzero: number; sample: number }> = {};
for (const t of dts) {
  const ln = lineupOf.get(t.trimId) ?? "?";
  by[ln] = by[ln] || { total: 0, matched: 0, nonzero: 0, sample: 0 };
  by[ln].total++;
  if (t.baseRates && t.vehiclePrice > 0) {
    by[ln].matched++;
    const s = t.baseRates["36_20000"] ?? 0;
    if (s > 0) { by[ln].nonzero++; if (!by[ln].sample) by[ln].sample = s; }
  }
}
console.log("상태:", done.status, `· 경고 ${(done.draft?.warnings || []).length}건`);
for (const [ln, x] of Object.entries(by)) {
  console.log(`  ${ln}: 매칭 ${x.matched}/${x.total} · 월납입금>0 ${x.nonzero} · 예시(36/2만) ${x.sample ? x.sample.toLocaleString() + "원" : "-"}`);
}
await p.$disconnect();
