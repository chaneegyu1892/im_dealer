import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { isCarpan2TrimCurrentlySold } from "../src/lib/vehicle-visibility-policy";

type Candidate = {
  readonly id: string;
  readonly name: string;
  readonly isVisible: boolean;
  readonly detailedSpecs: unknown;
  readonly vehicle: { readonly name: string; readonly slug: string };
  readonly lineup: { readonly name: string } | null;
  readonly _count: { readonly rateSheets: number };
};

type Change = Candidate & { readonly nextVisible: boolean };

async function main(): Promise<void> {
  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });

  const apply = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const candidates = await loadCandidates(prisma);
    const changes: Change[] = [];
    let unknownStateCount = 0;

    for (const candidate of candidates) {
      const sold = isCarpan2TrimCurrentlySold(candidate.detailedSpecs);
      if (sold === null) {
        unknownStateCount++;
        continue;
      }
      if (candidate.isVisible !== sold) {
        changes.push({ ...candidate, nextVisible: sold });
      }
    }

    printPlan(changes, unknownStateCount, apply);
    if (!apply || changes.length === 0) return;

    const ratedChanges = changes.filter((change) => change._count.rateSheets > 0);
    if (ratedChanges.length > 0) {
      throw new Error(
        `활성 회수율이 연결된 변경 대상 ${ratedChanges.length}개가 있어 적용을 중단했습니다.`,
      );
    }

    const showIds = changes.filter((change) => change.nextVisible).map((change) => change.id);
    const hideIds = changes.filter((change) => !change.nextVisible).map((change) => change.id);
    const result = await prisma.$transaction(async (tx) => {
      const shown = showIds.length > 0
        ? await tx.trim.updateMany({
            where: {
              id: { in: showIds },
              isVisible: false,
              vehicle: { isVisible: true },
              lineup: { is: { isVisible: true } },
            },
            data: { isVisible: true },
          })
        : { count: 0 };
      const hidden = hideIds.length > 0
        ? await tx.trim.updateMany({
            where: {
              id: { in: hideIds },
              isVisible: true,
              vehicle: { isVisible: true },
              lineup: { is: { isVisible: true } },
            },
            data: { isVisible: false },
          })
        : { count: 0 };
      return { shown: shown.count, hidden: hidden.count };
    });

    console.log(`적용 완료: 노출 ${result.shown}개 / 비노출 ${result.hidden}개`);
    if (result.shown + result.hidden !== changes.length) {
      throw new Error("계획 수와 실제 변경 수가 달라 재확인이 필요합니다.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function loadCandidates(prisma: PrismaClient): Promise<Candidate[]> {
  return prisma.trim.findMany({
    where: {
      externalId: { not: null },
      vehicle: { isVisible: true },
      lineup: { is: { isVisible: true } },
    },
    select: {
      id: true,
      name: true,
      isVisible: true,
      detailedSpecs: true,
      vehicle: { select: { name: true, slug: true } },
      lineup: { select: { name: true } },
      _count: {
        select: {
          rateSheets: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ vehicleId: "asc" }, { lineupId: "asc" }, { price: "asc" }],
  });
}

function printPlan(changes: readonly Change[], unknownStateCount: number, apply: boolean): void {
  const grouped = new Map<string, Change[]>();
  for (const change of changes) {
    const key = `${change.vehicle.name} (${change.vehicle.slug})`;
    grouped.set(key, [...(grouped.get(key) ?? []), change]);
  }

  console.log(`모드: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`현재 노출 차량·라인업의 Carpan2 트림 변경 대상: ${changes.length}개`);
  console.log(`원본 상태 미확인(변경 제외): ${unknownStateCount}개`);
  for (const [vehicle, vehicleChanges] of grouped) {
    const shown = vehicleChanges.filter((change) => change.nextVisible).length;
    const hidden = vehicleChanges.length - shown;
    const lineups = Array.from(
      new Set(vehicleChanges.map((change) => change.lineup?.name ?? "라인업 없음")),
    );
    console.log(`- ${vehicle}: 노출 ${shown} / 비노출 ${hidden}`);
    for (const lineup of lineups) console.log(`  · ${lineup}`);
  }
  if (!apply) console.log("변경하려면 --apply를 명시하세요.");
}

function parseArgs(args: readonly string[]): boolean {
  for (const arg of args) {
    if (arg !== "--apply") throw new Error(`알 수 없는 인자: ${arg}`);
  }
  return args.includes("--apply");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
