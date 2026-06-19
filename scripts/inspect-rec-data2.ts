import { prisma } from "../src/lib/prisma";

async function main() {
  const trims = await prisma.trim.findMany({
    select: { name: true, detailedSpecs: true, vehicle: { select: { category: true } } },
  });

  // 1) externalRaw.carry (적재중량) 분포 — 트럭/밴 화물 세분화 가능성
  const carry = new Map<string, number>();
  let personFilled = 0;
  const personDist = new Map<string, number>();
  for (const t of trims) {
    const raw = (t.detailedSpecs as any)?.externalRaw;
    if (raw?.carry !== undefined && raw?.carry !== null && raw?.carry !== "") {
      carry.set(String(raw.carry), (carry.get(String(raw.carry)) ?? 0) + 1);
    }
    if (raw?.person !== undefined && raw?.person !== "") {
      personFilled++;
      personDist.set(String(raw.person), (personDist.get(String(raw.person)) ?? 0) + 1);
    }
  }
  console.log("=== externalRaw.carry(적재중량 kg) 분포 [상위] ===");
  console.log([...carry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, n]) => `${k}kg: ${n}`).join("\n") || "(없음)");

  console.log(`\n=== externalRaw.person 채움: ${personFilled}/${trims.length} ===`);
  console.log("승차인원 분포:");
  console.log([...personDist.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, n]) => `${k}인승: ${n}`).join("\n"));

  // 2) 냉장/냉동/탑차 — 트림명
  const cold = trims.filter((t) => /냉장|냉동|탑차|윙바디|보냉/.test(t.name));
  console.log(`\n=== 냉장/냉동/탑차 트림명 매칭: ${cold.length} ===`);
  console.log([...new Set(cold.map((t) => t.name))].slice(0, 20).join("\n") || "(없음)");

  // 3) 트렁크 용량(리터) 구조화 여부 — Vehicle.detailedSpecs.technical_specs 확인
  const veh = await prisma.vehicle.findMany({ select: { name: true, detailedSpecs: true } });
  const vehWithTech = veh.filter((v) => (v.detailedSpecs as any)?.technical_specs);
  console.log(`\n=== Vehicle.detailedSpecs.technical_specs 채움: ${vehWithTech.length}/${veh.length} ===`);
  let trunkCount = 0;
  for (const v of veh) {
    const ts = (v.detailedSpecs as any)?.technical_specs;
    if (ts?.capacities?.trunk_capacity || ts?.dimensions?.trunk_capacity) trunkCount++;
  }
  console.log(`트렁크 용량(trunk_capacity) 구조화된 차량: ${trunkCount}/${veh.length}`);
  const vsample = vehWithTech[0];
  if (vsample) {
    console.log("technical_specs 샘플 키:", JSON.stringify(Object.keys((vsample.detailedSpecs as any).technical_specs)));
    console.log(JSON.stringify((vsample.detailedSpecs as any).technical_specs, null, 1).slice(0, 1200));
  }

  // 4) documents[].content 안전사양 텍스트 보유율 (기본 탑재 안전사양 파악 가능성)
  let withSafetyText = 0;
  for (const t of trims) {
    const docs = (t.detailedSpecs as any)?.externalRaw?.documents;
    if (Array.isArray(docs)) {
      const txt = docs.map((d: any) => d?.content ?? "").join(" ");
      if (/충돌방지 보조|차로 이탈|후측방|지능형 안전/.test(txt)) withSafetyText++;
    }
  }
  console.log(`\n=== documents 본문에 '지능형 안전' 텍스트 보유 트림: ${withSafetyText}/${trims.length} ===`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
