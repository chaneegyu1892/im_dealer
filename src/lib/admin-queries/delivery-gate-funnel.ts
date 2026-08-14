import { prisma } from "../prisma";
import type { DeliveryGateFunnel } from "@/types/admin-analytics";

/**
 * 견적서 받기 퍼널 — 세션 단위 집계 (회원 / 비회원 분할).
 *
 * 게이트 이벤트(ExplorationLog)와 계산 로그(QuoteCalcLog)는 견적 세션 ID 를 공유한다.
 * 계산 세션은 서로 겹치지 않게 나눈다.
 *
 * - memberCalculated: userId 가 있고 비회원 계산·게이트가 없는 세션. 견적 산출만 집계.
 * - guestCalculated:  그 외 계산 세션. 로그인 후 재계산으로 userId 가 채워져도
 *                     게이트를 본 세션은 비회원 퍼널에 남긴다.
 * - gateShown / loginClicked / converted: 비회원 게이트 단계.
 *   converted 는 게이트 표시 세션 중 clickedApply=true 행이 있는 세션.
 *   전환 시점은 기간 밖이어도 세션 연결만 되면 잡힌다.
 */
export async function getDeliveryGateFunnel(since: Date): Promise<DeliveryGateFunnel> {
  const rows = await prisma.$queryRaw<
    {
      member_calculated: bigint;
      guest_calculated: bigint;
      gate_shown: bigint;
      login_clicked: bigint;
      converted: bigint;
    }[]
  >`
    WITH gate AS (
      SELECT
        "sessionId",
        BOOL_OR("eventType" = 'delivery_gate_shown') AS shown,
        BOOL_OR("eventType" = 'delivery_gate_login_click') AS login
      FROM "ExplorationLog"
      WHERE "eventType" IN ('delivery_gate_shown', 'delivery_gate_login_click')
        AND "createdAt" >= ${since}
      GROUP BY "sessionId"
    ),
    calc AS (
      SELECT
        "sessionId",
        BOOL_OR("userId" IS NOT NULL) AS had_member,
        BOOL_OR("userId" IS NULL) AS had_guest
      FROM "QuoteCalcLog"
      WHERE "createdAt" >= ${since}
      GROUP BY "sessionId"
    ),
    classified AS (
      SELECT
        c."sessionId",
        (
          c.had_member
          AND NOT c.had_guest
          AND NOT COALESCE(g.shown, false)
        ) AS is_member
      FROM calc c
      LEFT JOIN gate g ON g."sessionId" = c."sessionId"
    )
    SELECT
      (SELECT COUNT(*) FROM classified WHERE is_member)::bigint AS member_calculated,
      (SELECT COUNT(*) FROM classified WHERE NOT is_member)::bigint AS guest_calculated,
      (SELECT COUNT(*) FROM gate WHERE shown)::bigint AS gate_shown,
      (SELECT COUNT(*) FROM gate WHERE login)::bigint AS login_clicked,
      (
        SELECT COUNT(*) FROM gate g2
        INNER JOIN (
          SELECT DISTINCT "sessionId" FROM "QuoteCalcLog" WHERE "clickedApply" = true
        ) conv ON conv."sessionId" = g2."sessionId"
        WHERE g2.shown
      )::bigint AS converted
  `;

  const row = rows[0];
  return {
    memberCalculated: Number(row?.member_calculated ?? 0),
    guestCalculated: Number(row?.guest_calculated ?? 0),
    gateShown: Number(row?.gate_shown ?? 0),
    loginClicked: Number(row?.login_clicked ?? 0),
    converted: Number(row?.converted ?? 0),
  };
}
