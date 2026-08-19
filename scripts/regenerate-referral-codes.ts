/**
 * 7자리 추천 코드(대문자 1 + 숫자 6)를 5자리(대문자 1 + 숫자 4)로 되돌린다.
 *
 * 사용법:
 *   pnpm exec tsx scripts/regenerate-referral-codes.ts          # dry-run (기본, 쓰기 없음)
 *   pnpm exec tsx scripts/regenerate-referral-codes.ts --apply  # 실제 UPDATE 수행
 *
 * 주의: Referral.code 는 가입 시점에 실제로 입력된 코드의 이력이므로 건드리지 않는다.
 *       (추천 관계는 referrerId/refereeId 로 연결돼 있어 코드 교체의 영향을 받지 않는다.)
 */
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { generateReferralCode, REFERRAL_CODE_PATTERN } from "../src/lib/referral/code";

/** 롤백 대상: 7자리 레거시 코드. */
const LEGACY_CODE_PATTERN = /^[A-Z][0-9]{6}$/;
/** 코드 1건당 유니크 충돌 재시도 한도. */
const MAX_ATTEMPTS = 50;
/** 사용자 스캔 페이지 크기. */
const PAGE_SIZE = 1000;
/** dry-run 에서 미리보기로 출력할 최대 행 수. */
const PREVIEW_ROWS = 20;

type CodedUser = {
  readonly id: string;
  readonly name: string;
  readonly referralCode: string;
};

type Plan = {
  readonly user: CodedUser;
  readonly nextCode: string;
};

async function main(): Promise<void> {
  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });

  const apply = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const users = await loadUsersWithCode(prisma);
    const legacy = users.filter((u) => LEGACY_CODE_PATTERN.test(u.referralCode));
    const valid = users.filter((u) => REFERRAL_CODE_PATTERN.test(u.referralCode));
    const other = users.filter(
      (u) =>
        !LEGACY_CODE_PATTERN.test(u.referralCode) && !REFERRAL_CODE_PATTERN.test(u.referralCode),
    );

    console.log(`모드: ${apply ? "APPLY (DB 쓰기)" : "DRY-RUN (쓰기 없음)"}`);
    console.log("── 추천 코드 집계 ─────────────────────────");
    console.log(`코드 보유 사용자      : ${users.length}건`);
    console.log(`5자리(정상)           : ${valid.length}건`);
    console.log(`7자리(롤백 대상)      : ${legacy.length}건`);
    console.log(`기타 형식(수동 확인)  : ${other.length}건`);
    for (const u of other.slice(0, PREVIEW_ROWS)) {
      console.log(`  · ${u.id} ${u.referralCode}`);
    }

    if (legacy.length === 0) {
      console.log("\n7자리 코드가 없다. 변경할 대상 없음.");
      return;
    }

    const taken = new Set(users.map((u) => u.referralCode));
    const plans: Plan[] = [];
    for (const user of legacy) {
      const nextCode = allocateCode(taken);
      taken.delete(user.referralCode);
      taken.add(nextCode);
      plans.push({ user, nextCode });
    }

    console.log("\n── 교체 계획 ─────────────────────────────");
    for (const plan of plans.slice(0, PREVIEW_ROWS)) {
      console.log(`  ${plan.user.referralCode} → ${plan.nextCode}  (${plan.user.name})`);
    }
    if (plans.length > PREVIEW_ROWS) {
      console.log(`  … 외 ${plans.length - PREVIEW_ROWS}건`);
    }

    if (!apply) {
      console.log(`\nDRY-RUN 종료. 실제 반영하려면 --apply 를 붙여 다시 실행한다. (대상 ${plans.length}건)`);
      return;
    }

    let updated = 0;
    const failures: string[] = [];
    for (const plan of plans) {
      const result = await updateWithRetry(prisma, plan);
      if (result.ok) {
        updated += 1;
        console.log(`[APPLY] ${plan.user.referralCode} → ${result.code} (${plan.user.id})`);
      } else {
        failures.push(`${plan.user.id} (${plan.user.referralCode}): ${result.reason}`);
      }
    }

    console.log(`\n완료: ${updated}건 교체, ${failures.length}건 실패`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: readonly string[]): boolean {
  let apply = false;
  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else throw new Error(`알 수 없는 인자: ${arg} (사용 가능: --apply, --dry-run)`);
  }
  return apply;
}

async function loadUsersWithCode(prisma: PrismaClient): Promise<CodedUser[]> {
  const collected: CodedUser[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await prisma.user.findMany({
      where: { referralCode: { not: null } },
      select: { id: true, name: true, referralCode: true },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (page.length === 0) break;

    for (const row of page) {
      if (row.referralCode) {
        collected.push({ id: row.id, name: row.name, referralCode: row.referralCode });
      }
    }
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1]?.id;
    if (!cursor) break;
  }

  return collected;
}

/** 메모리상 점유 집합을 피해 5자리 코드를 뽑는다. */
function allocateCode(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = generateReferralCode();
    if (!taken.has(code)) return code;
  }
  throw new Error("5자리 코드 공간에서 미사용 코드를 찾지 못했다 (충돌 과다)");
}

type UpdateResult = { ok: true; code: string } | { ok: false; reason: string };

/** 유니크 충돌(P2002)이 나면 다른 코드로 재시도한다. */
async function updateWithRetry(prisma: PrismaClient, plan: Plan): Promise<UpdateResult> {
  let code = plan.nextCode;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      await prisma.user.update({
        where: { id: plan.user.id },
        data: { referralCode: code },
        select: { id: true },
      });
      return { ok: true, code };
    } catch (err) {
      const prismaCode = (err as { code?: string }).code;
      if (prismaCode !== "P2002") {
        return { ok: false, reason: err instanceof Error ? err.message : String(err) };
      }
      code = generateReferralCode();
    }
  }
  return { ok: false, reason: `유니크 충돌 ${MAX_ATTEMPTS}회 초과` };
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
