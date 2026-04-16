import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function refineData() {
  console.log("Starting full data refinement for 20 vehicles...");

  const vehicles = await prisma.vehicle.findMany({
    include: {
      trims: {
        include: {
          options: true,
        },
      },
      lineups: true,
    },
  });

  for (const vehicle of vehicles) {
    console.log(`\nRefining vehicle: ${vehicle.brand} ${vehicle.name}`);

    // 1. Identify Lineups based on trims
    const engineTypes = [...new Set(vehicle.trims.map(t => t.engineType))];
    const newLineupNames = new Set<string>();

    // Specialty logic for complex models
    if (vehicle.name.includes("카니발")) {
      // Carnival special: Group by Fuel + Seating
      vehicle.trims.forEach(t => {
        const seating = t.name.match(/\d인승/)?.[0] || "";
        const type = t.name.includes("하이리무진") ? "하이리무진" : "일반";
        const engine = t.name.includes("하이브리드") ? "하이브리드" : t.engineType;
        newLineupNames.add(`${type} ${engine} ${seating}`.trim());
      });
    } else if (vehicle.name.includes("그랜저") || vehicle.name.includes("쏘렌토") || vehicle.name.includes("싼타페")) {
      vehicle.trims.forEach(t => {
        const engine = t.name.includes("하이브리드") ? "하이브리드" : t.engineType;
        const capacity = t.name.match(/\d인승/)?.[0] || "";
        newLineupNames.add(`${engine} ${capacity}`.trim());
      });
    } else if (["아이오닉 5", "아이오닉 6", "EV6", "EV9"].includes(vehicle.name)) {
      vehicle.trims.forEach(t => {
        const range = t.name.includes("롱레인지") ? "Long Range" : t.name.includes("스탠다드") ? "Standard" : "EV";
        newLineupNames.add(range);
      });
    } else {
      engineTypes.forEach(et => newLineupNames.add(et));
    }

    // 2. Create New Lineups
    const createdLineups: Record<string, string> = {};
    for (const name of Array.from(newLineupNames)) {
      const lineup = await prisma.vehicleLineup.create({
        data: {
          vehicleId: vehicle.id,
          name: name,
        },
      });
      createdLineups[name] = lineup.id;
    }

    // 3. Assign Trims to new lineups
    for (const trim of vehicle.trims) {
      let targetLineupName = trim.engineType;
      
      // Matching logic mirrors the lineup creation logic above
      if (vehicle.name.includes("카니발")) {
        const seating = trim.name.match(/\d인승/)?.[0] || "";
        const type = trim.name.includes("하이리무진") ? "하이리무진" : "일반";
        const engine = trim.name.includes("하이브리드") ? "하이브리드" : trim.engineType;
        targetLineupName = `${type} ${engine} ${seating}`.trim();
      } else if (vehicle.name.includes("그랜저") || vehicle.name.includes("쏘렌토") || vehicle.name.includes("싼타페")) {
        const engine = trim.name.includes("하이브리드") ? "하이브리드" : trim.engineType;
        const capacity = trim.name.match(/\d인승/)?.[0] || "";
        targetLineupName = `${engine} ${capacity}`.trim();
      } else if (["아이오닉 5", "아이오닉 6", "EV6", "EV9"].includes(vehicle.name)) {
        targetLineupName = trim.name.includes("롱레인지") ? "Long Range" : trim.name.includes("스탠다드") ? "Standard" : "EV";
      }

      const lineupId = createdLineups[targetLineupName];
      if (lineupId) {
        await prisma.trim.update({
          where: { id: trim.id },
          data: { lineupId: lineupId },
        });
      }

      // 4. Add Option Rules for this trim
      await addOptionRules(trim);
    }

    // 5. Cleanup "기본 라인업"
    const oldLineups = vehicle.lineups.filter(l => l.name === "기본 라인업");
    if (oldLineups.length > 0) {
      await prisma.vehicleLineup.deleteMany({
        where: { id: { in: oldLineups.map(l => l.id) } },
      });
      console.log(`  Removed ${oldLineups.length} placeholder lineups.`);
    }
  }

  console.log("\nData refinement completed successfully!");
}

async function addOptionRules(trim: any) {
  const options = trim.options;
  const rules = [];

  // Common Helper to find options by partial name
  const findOpt = (name: string) => options.find((o: any) => o.name.includes(name));

  // 1. Tech Package Rules (Global)
  const nav = findOpt("네비게이션") || findOpt("내비게이션");
  const cam = findOpt("빌트인 캠");
  const hud = findOpt("헤드업 디스플레이") || findOpt("HUD");
  const cluster = findOpt("클러스터");

  if (cam && nav) rules.push({ type: "REQUIRED", src: cam.id, tgt: nav.id });
  if (cam && cluster) rules.push({ type: "REQUIRED", src: cam.id, tgt: cluster.id });
  if (hud && nav) rules.push({ type: "REQUIRED", src: hud.id, tgt: nav.id });

  // 2. Sunroof vs Solar Rules
  const sunroof = findOpt("선루프");
  const solar = findOpt("솔라루프");
  if (sunroof && solar) rules.push({ type: "CONFLICT", src: sunroof.id, tgt: solar.id });

  // 3. Design Package Rules (Specific)
  if (trim.name.includes("블랙 잉크")) {
    const whiteColor = options.find((o: any) => o.name.includes("화이트") && o.category?.includes("색상"));
    const silverColor = options.find((o: any) => o.name.includes("실버") && o.category?.includes("색상"));
    // Black Ink restricts many colors, only allowing Black/White/Gray typically
    if (silverColor) rules.push({ type: "CONFLICT", src: trim.options[0].id, tgt: silverColor.id }); // Using first opt as proxy for 'trim' existence
  }

  // 4. Seating Comfort (SUV/MPV)
  const seating2nd = findOpt("2열") && findOpt("컴포트");
  if (seating2nd && trim.name.includes("5인승")) {
    // 5-seaters might not support 2nd row relaxation seats in some models
    // This is just a sample rule logic
  }

  // Batch insert rules
  for (const r of rules) {
    // For CONFLICT, we add bidirectional rules in the API, but let's do it manually if needed or just use the logic
    await prisma.optionRule.create({
      data: {
        trimId: trim.id,
        ruleType: r.type,
        sourceOptionId: r.src,
        targetOptionId: r.tgt,
      },
    });

    if (r.type === "CONFLICT") {
      await prisma.optionRule.create({
        data: {
          trimId: trim.id,
          ruleType: "CONFLICT",
          sourceOptionId: r.tgt,
          targetOptionId: r.src,
        },
      });
    }
  }
}

refineData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
