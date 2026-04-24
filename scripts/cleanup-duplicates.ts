import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== 중복 데이터 정리 시작 ===\n");

  // ─────────────────────────────────────────
  // 1. 트림이 0개인 라인업 삭제
  // ─────────────────────────────────────────
  const emptyLineups = await prisma.vehicleLineup.findMany({
    include: { trims: true, vehicle: true },
  });

  const lineupToDelete: string[] = [];

  for (const lineup of emptyLineups) {
    if (lineup.trims.length === 0) {
      lineupToDelete.push(lineup.id);
      console.log(
        `[라인업 삭제] ${lineup.vehicle.name} > "${lineup.name}" (트림 없음)`
      );
    }
  }

  // ─────────────────────────────────────────
  // 2. 같은 차량 내 중복 라인업 이름 처리
  //    → 트림이 적은 쪽(0개 우선) 삭제
  // ─────────────────────────────────────────
  const allLineups = await prisma.vehicleLineup.findMany({
    include: { trims: { include: { options: true } }, vehicle: true },
    orderBy: { createdAt: "asc" },
  });

  // vehicleId+name 기준으로 그룹핑
  const lineupGroups = new Map<string, typeof allLineups>();
  for (const lineup of allLineups) {
    const key = `${lineup.vehicleId}::${lineup.name}`;
    if (!lineupGroups.has(key)) lineupGroups.set(key, []);
    lineupGroups.get(key)!.push(lineup);
  }

  for (const [key, group] of lineupGroups.entries()) {
    if (group.length <= 1) continue;

    const [vehicleId, name] = key.split("::");
    console.log(
      `\n[중복 라인업] "${name}" × ${group.length}개 (차량: ${group[0].vehicle.name})`
    );

    // 트림 수로 정렬 — 많은 쪽 유지
    const sorted = [...group].sort((a, b) => b.trims.length - a.trims.length);
    const keep = sorted[0];
    const toRemove = sorted.slice(1);

    console.log(
      `  유지: id=${keep.id} (트림 ${keep.trims.length}개)`
    );

    for (const dup of toRemove) {
      if (!lineupToDelete.includes(dup.id)) {
        lineupToDelete.push(dup.id);
        console.log(
          `  삭제: id=${dup.id} (트림 ${dup.trims.length}개)`
        );
      }
    }
  }

  if (lineupToDelete.length > 0) {
    const result = await prisma.vehicleLineup.deleteMany({
      where: { id: { in: lineupToDelete } },
    });
    console.log(`\n→ 라인업 ${result.count}개 삭제 완료`);
  } else {
    console.log("\n→ 삭제할 라인업 없음");
  }

  // ─────────────────────────────────────────
  // 3. 같은 라인업 내 중복 트림 이름 처리
  //    → 옵션이 없는 쪽 삭제
  // ─────────────────────────────────────────
  console.log("\n--- 중복 트림 검사 ---");

  const allTrims = await prisma.trim.findMany({
    include: {
      options: true,
      lineup: true,
      vehicle: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // lineupId+name 기준으로 그룹핑 (lineupId null이면 vehicleId+name)
  const trimGroups = new Map<string, typeof allTrims>();
  for (const trim of allTrims) {
    const key = `${trim.lineupId ?? trim.vehicleId}::${trim.name}`;
    if (!trimGroups.has(key)) trimGroups.set(key, []);
    trimGroups.get(key)!.push(trim);
  }

  const trimToDelete: string[] = [];

  for (const [key, group] of trimGroups.entries()) {
    if (group.length <= 1) continue;

    const first = group[0];
    const lineupName = first.lineup?.name ?? "(라인업 없음)";
    console.log(
      `\n[중복 트림] "${first.name}" × ${group.length}개 (${first.vehicle.name} / ${lineupName})`
    );

    // 옵션 수로 정렬 — 많은 쪽 유지
    const sorted = [...group].sort(
      (a, b) => b.options.length - a.options.length
    );
    const keep = sorted[0];
    const toRemove = sorted.slice(1);

    console.log(
      `  유지: id=${keep.id} (옵션 ${keep.options.length}개)`
    );

    for (const dup of toRemove) {
      trimToDelete.push(dup.id);
      console.log(
        `  삭제: id=${dup.id} (옵션 ${dup.options.length}개)`
      );
    }
  }

  if (trimToDelete.length > 0) {
    const result = await prisma.trim.deleteMany({
      where: { id: { in: trimToDelete } },
    });
    console.log(`\n→ 트림 ${result.count}개 삭제 완료`);
  } else {
    console.log("\n→ 삭제할 중복 트림 없음");
  }

  console.log("\n=== 정리 완료 ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
