import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const db = p as any;
const FC = "cmnk4eoqq0007dr2tbg3azlcc";
const BRAND_CD: Record<string, string> = { "현대": "CA100001", "기아": "CA100002", "제네시스": "CA100088" };
const LINEUP = process.argv[2] ?? "하이브리드"; // 단일 라인업명 (UI 라인업 단독 선택 시뮬레이션)

const v = await p.vehicle.findFirst({ where: { name: "그랜저" }, include: { lineups: true, trims: { include: { lineup: true } } } });
if (!v) { console.log("그랜저 없음"); process.exit(0); }
const LIMIT = Number(process.argv[3] ?? 0); // >0 이면 앞에서 N개만 (진단용)
const all = v.trims.filter((t) => t.lineupId && t.lineup?.name === LINEUP);
const trims = LIMIT > 0 ? all.slice(0, LIMIT) : all;
if (trims.length === 0) { console.log(`라인업 '${LINEUP}' 트림 없음`); process.exit(0); }
const lineupId = trims[0].lineupId!;
const job = await db.scrapeJob.create({
  data: {
    financeCompanyId: FC, status: "pending", productType: "장기렌트",
    params: {
      trimIds: trims.map((t) => t.id), vehicleId: v.id, lineupIds: [lineupId],
      weekOf: "2026-06-15", minVehiclePrice: 0, maxVehiclePrice: 0,
      scraperRef: { brandCd: BRAND_CD[v.brand], modelName: v.name },
      trims: trims.map((t) => ({ trimId: t.id, name: t.name })),
    },
    createdById: "verify-script",
  },
});
console.log(`라인업 단독검증 잡 생성: ${job.id} (${LINEUP} ${trims.length}트림) — 처리 대기...`);

let done = null;
for (let i = 0; i < 200; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const j = await db.scrapeJob.findUnique({ where: { id: job.id } });
  if (j.status === "completed" || j.status === "failed") { done = j; break; }
}
if (!done) { console.log("시간초과"); process.exit(0); }

const dts = done.draft?.trims || [];
let matched = 0, nonzero = 0;
for (const t of dts) {
  if (t.baseRates && t.vehiclePrice > 0) { matched++; if ((t.baseRates["36_20000"] ?? 0) > 0) nonzero++; }
}
console.log("상태:", done.status);
console.log(`${LINEUP} [매칭 / 월납입금>0]: ${matched} / ${nonzero} (전체 ${trims.length})`);
await p.$disconnect();
