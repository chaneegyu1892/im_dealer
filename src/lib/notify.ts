const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

function mask(value: string | null | undefined): string {
  if (!value) return "-";
  if (value.length <= 4) return "****";
  return value.slice(0, 2) + "****" + value.slice(-2);
}

async function send(text: string): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // 알림 실패가 본 응답을 막아선 안 됨
  }
}

interface NewQuoteParams {
  quoteId: string;
  vehicleName: string;
  trimName: string;
  monthlyPayment: number;
  contractMonths: number;
  userId?: string | null;
  appUrl?: string;
}

export async function notifyNewQuote(p: NewQuoteParams): Promise<void> {
  const monthly = Math.round(p.monthlyPayment / 10000).toLocaleString();
  const adminUrl = `${p.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/quotations`;
  await send(
    `🆕 *새 견적 저장*\n` +
    `• 차량: ${p.vehicleName} ${p.trimName}\n` +
    `• 월납: ${monthly}만원 / ${p.contractMonths}개월\n` +
    `• 사용자: ${mask(p.userId)}\n` +
    `• <${adminUrl}|어드민 견적 목록 보기>`
  );
}

interface VerificationSubmittedParams {
  sessionId: string;
  customerName?: string | null;
  appUrl?: string;
}

export async function notifyVerificationSubmitted(p: VerificationSubmittedParams): Promise<void> {
  const adminUrl = `${p.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/quotations`;
  await send(
    `📋 *본인인증 제출*\n` +
    `• 고객명: ${mask(p.customerName)}\n` +
    `• 세션: ${p.sessionId.slice(0, 12)}…\n` +
    `• <${adminUrl}|어드민에서 확인하기>`
  );
}
