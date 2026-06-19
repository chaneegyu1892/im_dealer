/**
 * 일회성 데이터 점검 — AI 추천 고도화에 필요한 차량 속성 데이터가
 * 실제로 DB에 존재하는지 읽기 전용으로 조사한다.
 */
import { prisma } from "../src/lib/prisma";

function pickSpecKeys(json: unknown): string[] {
  if (!json || typeof json !== "object") return [];
  const out = new Set<string>();
  const walk = (o: any, prefix = "") => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const path = prefix ? `${prefix}.${k}` : k;
      out.add(path);
      if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) walk(o[k], path);
    }
  };
  walk(json);
  return [...out];
}

async function main() {
  const [vCount, tCount, oCount] = await Promise.all([
    prisma.vehicle.count(),
    prisma.trim.count(),
    prisma.trimOption.count(),
  ]);
  console.log("=== 규모 ===");
  console.log({ vehicles: vCount, trims: tCount, trimOptions: oCount });

  // 1) 카테고리 분포
  const cats = await prisma.vehicle.groupBy({ by: ["category"], _count: true });
  console.log("\n=== category 분포 ===");
  console.log(cats.map((c) => `${c.category}: ${c._count}`).join("\n"));

  // 2) engineType 분포
  const engines = await prisma.trim.groupBy({ by: ["engineType"], _count: true });
  console.log("\n=== engineType 분포 ===");
  console.log(engines.map((e) => `${e.engineType}: ${e._count}`).join("\n"));

  // 3) 트림명에 AWD/4WD/사륜 들어있는지
  const trims = await prisma.trim.findMany({
    select: { name: true, detailedSpecs: true, specs: true },
  });
  const awd = trims.filter((t) => /AWD|4WD|4MATIC|4motion|사륜|x[Dd]rive|quattro/i.test(t.name));
  console.log(`\n=== 트림명 AWD/4WD 매칭: ${awd.length}/${trims.length} ===`);
  console.log(awd.slice(0, 15).map((t) => t.name).join("\n") || "(없음)");

  // 4) detailedSpecs 채워진 정도 + 키 종류
  const withDetailed = trims.filter((t) => t.detailedSpecs);
  const withSpecs = trims.filter((t) => t.specs);
  console.log(`\n=== 스펙 채움 정도 ===`);
  console.log({ trims_with_detailedSpecs: withDetailed.length, trims_with_specs: withSpecs.length });

  const keyFreq = new Map<string, number>();
  for (const t of trims) {
    for (const k of pickSpecKeys(t.detailedSpecs)) keyFreq.set(k, (keyFreq.get(k) ?? 0) + 1);
  }
  const interesting = [...keyFreq.entries()].filter(([k]) =>
    /trunk|cargo|person|seat|승차|적재|trim|capacit|door|구동|drive|wheel|range|battery/i.test(k)
  );
  console.log("\n=== detailedSpecs 관심 키 (빈도) ===");
  console.log(interesting.sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join("\n") || "(관심 키 없음)");

  // 샘플 하나 통째로
  const sample = trims.find((t) => t.detailedSpecs);
  console.log("\n=== detailedSpecs 샘플(1건) ===");
  console.log(JSON.stringify(sample?.detailedSpecs ?? null, null, 2)?.slice(0, 2000));

  // 5) 트림 옵션명 — 슬라이딩도어/안전사양 키워드
  const opts = await prisma.trimOption.findMany({ select: { name: true, category: true } });
  const slide = opts.filter((o) => /슬라이딩|sliding|파워\s*도어|듀얼\s*도어/i.test(o.name));
  const safety = opts.filter((o) =>
    /후측방|사각|충돌|긴급제동|FCA|BCW|차로|LKA|어시스트|주행보조|HDA|안전|에어백|ADAS/i.test(o.name)
  );
  console.log(`\n=== 옵션명 슬라이딩도어 매칭: ${slide.length} ===`);
  console.log([...new Set(slide.map((o) => o.name))].slice(0, 15).join("\n") || "(없음)");
  console.log(`\n=== 옵션명 안전사양 매칭: ${safety.length} ===`);
  console.log([...new Set(safety.map((o) => o.name))].slice(0, 25).join("\n") || "(없음)");

  // 옵션 카테고리 분포
  const optCats = await prisma.trimOption.groupBy({ by: ["category"], _count: true });
  console.log("\n=== 옵션 category 분포 ===");
  console.log(optCats.map((c) => `${c.category ?? "(null)"}: ${c._count}`).join("\n"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
