import type { QuoteStatus } from "@prisma/client";

/** 추천 진행 단계 라벨. UI 스텝퍼·퍼널이 같은 순서를 공유한다. */
export const REFERRAL_STEP_LABELS = ["가입", "견적", "상담", "계약"] as const;

export type ReferralStep = 1 | 2 | 3 | 4;

export interface ReferralQuoteSnapshot {
  status: QuoteStatus;
  contactedAt: Date | null;
}

export interface ReferralProgressItem {
  id: string;
  /** 김*규 형태로 마스킹된 이름 (원문은 클라이언트에 보내지 않는다) */
  maskedName: string;
  /** KST 기준 가입일 라벨 (예: 2026.08.10) */
  signedUpLabel: string;
  /** 도달한 최고 단계. LOST 건의 과거 도달 이력도 포함한다. */
  step: ReferralStep;
  /** 견적이 1건 이상 있지만 전부 LOST이고 계약 전환은 없는 상태 */
  isLost: boolean;
}

export interface ReferralFunnel {
  signup: number;
  quote: number;
  consult: number;
  contract: number;
}

/** 이름 마스킹: 첫 글자와 마지막 글자만 남기고 가운데를 * 처리 (김*규, 김*, 외국 이름도 동일 규칙) */
export function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "*";
  if (trimmed.length === 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

/** KST 기준 YYYY.MM.DD */
export function formatKstDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}.${m}.${d}`;
}

/** 견적 1건이 의미하는 도달 단계. LOST는 contactedAt으로 상담 도달 여부를 판별한다. */
function quoteStep(quote: ReferralQuoteSnapshot): ReferralStep {
  switch (quote.status) {
    case "CONVERTED":
      return 4;
    case "CONTACTED":
    case "IN_PROGRESS":
      return 3;
    case "LOST":
      return quote.contactedAt ? 3 : 2;
    default:
      return 2; // NEW
  }
}

export function buildReferralProgressItem(input: {
  id: string;
  refereeName: string;
  signedUpAt: Date;
  quotes: ReferralQuoteSnapshot[];
}): ReferralProgressItem {
  const step = input.quotes.reduce<ReferralStep>(
    (max, q) => Math.max(max, quoteStep(q)) as ReferralStep,
    1,
  );
  const hasOpenQuote = input.quotes.some((q) => q.status !== "LOST");
  return {
    id: input.id,
    maskedName: maskName(input.refereeName),
    signedUpLabel: formatKstDate(input.signedUpAt),
    step,
    isLost: input.quotes.length > 0 && !hasOpenQuote && step < 4,
  };
}

/** 퍼널 집계: 각 단계에 "도달한 적 있는" 인원 수 (LOST 이력 포함, 누적 전체) */
export function computeReferralFunnel(items: readonly ReferralProgressItem[]): ReferralFunnel {
  return {
    signup: items.length,
    quote: items.filter((i) => i.step >= 2).length,
    consult: items.filter((i) => i.step >= 3).length,
    contract: items.filter((i) => i.step >= 4).length,
  };
}
