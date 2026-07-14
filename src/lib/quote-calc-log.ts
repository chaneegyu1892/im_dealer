import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type QuoteCalcLogWrite = Omit<
  Prisma.QuoteCalcLogUncheckedCreateInput,
  "id" | "createdAt" | "calculatedAt" | "clickedApply"
>;

/**
 * 동일 세션에서 같은 차량/시나리오를 다시 계산하면 최신 조건과 결과로 갱신한다.
 * 신청 여부(clickedApply)는 update 데이터에서 제외해 한 번 true가 된 기록을 보존한다.
 */
export async function upsertQuoteCalcLog(data: QuoteCalcLogWrite) {
  const { sessionId, vehicleSlug, scenarioType, ...latest } = data;
  const calculatedAt = new Date();

  return prisma.quoteCalcLog.upsert({
    where: {
      sessionId_vehicleSlug_scenarioType: {
        sessionId,
        vehicleSlug,
        scenarioType,
      },
    },
    create: { ...data, calculatedAt },
    update: { ...latest, calculatedAt },
  });
}

export async function upsertQuoteCalcLogs(rows: QuoteCalcLogWrite[]) {
  await Promise.all(rows.map((row) => upsertQuoteCalcLog(row)));
}
