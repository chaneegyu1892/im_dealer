import { prisma } from "../prisma";
import type { DeliveryGateFunnel } from "@/types/admin-analytics";

/**
 * 견적서 받기 로그인 게이트 퍼널 — 세션 단위 집계.
 *
 * 게이트 정책 재검토용 지표. 게이트 이벤트(ExplorationLog)와 계산 로그(QuoteCalcLog)는
 * 견적 세션 ID 를 공유하므로 sessionId 조인으로 단계별 전환을 잰다.
 *
 * - calculated:   기간 내 견적 산출 세션 (회원·비회원 전체 — 게이트는 비회원만 만나므로
 *                 회원 세션은 자연스럽게 아래 단계에서 빠진다)
 * - gateShown:    delivery_gate_shown 이벤트가 있는 세션
 * - loginClicked: delivery_gate_login_click 이벤트가 있는 세션
 * - converted:    게이트 표시 세션 중 clickedApply=true 계산 행이 있는 세션.
 *                 전환 시점은 기간 밖이어도 세션 연결만 되면 잡힌다.
 */
export async function getDeliveryGateFunnel(since: Date): Promise<DeliveryGateFunnel> {
  const rows = await prisma.$queryRaw<
    {
      calculated: bigint;
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
    )
    SELECT
      (SELECT COUNT(DISTINCT "sessionId") FROM "QuoteCalcLog"
        WHERE "createdAt" >= ${since})::bigint AS calculated,
      COUNT(*) FILTER (WHERE g.shown)::bigint AS gate_shown,
      COUNT(*) FILTER (WHERE g.login)::bigint AS login_clicked,
      COUNT(*) FILTER (WHERE g.shown AND c."sessionId" IS NOT NULL)::bigint AS converted
    FROM gate g
    LEFT JOIN (
      SELECT DISTINCT "sessionId" FROM "QuoteCalcLog" WHERE "clickedApply" = true
    ) c ON c."sessionId" = g."sessionId"
  `;

  const row = rows[0];
  return {
    calculated: Number(row?.calculated ?? 0),
    gateShown: Number(row?.gate_shown ?? 0),
    loginClicked: Number(row?.login_clicked ?? 0),
    converted: Number(row?.converted ?? 0),
  };
}
