/**
 * 기존 평문 PII 행을 일괄 암호화하는 마이그레이션 스크립트.
 *
 * 운영 배포 시 1회 실행:
 *   PII_ENCRYPTION_KEY=<base64-32byte> npx tsx scripts/encrypt-existing-pii.ts
 *
 * 멱등성:
 *   - 이미 EncryptedBlob 형식인 행은 skip
 *   - 평문 JSON 만 encryptPII 적용
 *   - connectedId 도 동일 (JSON 문자열 wrapper)
 *
 * 안전 장치:
 *   - 배치 100건씩 처리 (대형 테이블 락 회피)
 *   - 행 단위 try/catch 로 일부 실패 시 나머지 계속 진행
 *   - 처리 결과 카운트 출력
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  encryptPII,
  encryptString,
  isEncryptedBlob,
} from "../src/lib/pii";

const BATCH_SIZE = 100;

interface ProgressCounter {
  scanned: number;
  encrypted: number;
  alreadyEncrypted: number;
  failed: number;
}

function isStringAlreadyEncrypted(value: string | null): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return isEncryptedBlob(parsed);
  } catch {
    return false;
  }
}

async function processBatch(
  rows: Array<{
    id: string;
    connectedId: string | null;
    licenseData: unknown;
    insuranceData: unknown;
    bizData: unknown;
  }>,
  counter: ProgressCounter
): Promise<void> {
  for (const row of rows) {
    counter.scanned++;
    try {
      const data: Prisma.CustomerVerificationUpdateInput = {};
      let touched = false;

      if (row.connectedId && !isStringAlreadyEncrypted(row.connectedId)) {
        data.connectedId = encryptString(row.connectedId);
        touched = true;
      }

      if (row.licenseData != null && !isEncryptedBlob(row.licenseData)) {
        data.licenseData = encryptPII(row.licenseData) as unknown as Prisma.InputJsonValue;
        touched = true;
      }

      if (row.insuranceData != null && !isEncryptedBlob(row.insuranceData)) {
        data.insuranceData = encryptPII(row.insuranceData) as unknown as Prisma.InputJsonValue;
        touched = true;
      }

      if (row.bizData != null && !isEncryptedBlob(row.bizData)) {
        data.bizData = encryptPII(row.bizData) as unknown as Prisma.InputJsonValue;
        touched = true;
      }

      if (touched) {
        await prisma.customerVerification.update({
          where: { id: row.id },
          data,
        });
        counter.encrypted++;
      } else {
        counter.alreadyEncrypted++;
      }
    } catch (err) {
      counter.failed++;
      console.error(`[encrypt-existing-pii] row ${row.id} 실패:`, err);
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.PII_ENCRYPTION_KEY) {
    throw new Error(
      "PII_ENCRYPTION_KEY 환경변수가 필요합니다. .env 또는 명령행에서 지정하세요."
    );
  }

  const counter: ProgressCounter = {
    scanned: 0,
    encrypted: 0,
    alreadyEncrypted: 0,
    failed: 0,
  };

  const where: Prisma.CustomerVerificationWhereInput = {
    OR: [
      { connectedId: { not: null } },
      { licenseData: { not: Prisma.JsonNull } },
      { insuranceData: { not: Prisma.JsonNull } },
      { bizData: { not: Prisma.JsonNull } },
    ],
  };

  let cursor: string | undefined = undefined;
  type Row = {
    id: string;
    connectedId: string | null;
    licenseData: unknown;
    insuranceData: unknown;
    bizData: unknown;
  };
  while (true) {
    const rows: Row[] = await prisma.customerVerification.findMany({
      where,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        connectedId: true,
        licenseData: true,
        insuranceData: true,
        bizData: true,
      },
    });

    if (rows.length === 0) break;

    await processBatch(rows, counter);
    cursor = rows[rows.length - 1].id;

    console.log(
      `[encrypt-existing-pii] 진행: scanned=${counter.scanned}, encrypted=${counter.encrypted}, skipped=${counter.alreadyEncrypted}, failed=${counter.failed}`
    );

    if (rows.length < BATCH_SIZE) break;
  }

  console.log("\n[encrypt-existing-pii] 완료");
  console.log(`  - 스캔: ${counter.scanned} 행`);
  console.log(`  - 신규 암호화: ${counter.encrypted} 행`);
  console.log(`  - 이미 암호화됨(skip): ${counter.alreadyEncrypted} 행`);
  console.log(`  - 실패: ${counter.failed} 행`);

  if (counter.failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
