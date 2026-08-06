import type { MyPageQuote, MyPageStatusTone } from "@/lib/member-queries/mypage";

export const moneyFormatter = new Intl.NumberFormat("ko-KR");
export const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

export const statusToneClasses: Record<MyPageStatusTone, string> = {
  neutral: "bg-surface-soft text-text-body",
  info: "bg-status-info-soft text-status-info",
  warning: "bg-status-warning-soft text-status-warning",
  positive: "bg-status-positive-soft text-status-positive",
  danger: "bg-status-danger-soft text-status-danger",
};

export function getQuoteHref(quote: MyPageQuote): string | null {
  if (!quote.vehicleSlug) return null;

  const params = new URLSearchParams({
    vehicle: quote.vehicleSlug,
    trim: quote.trimId,
    customerType: quote.customerType,
    productType: quote.productType,
    contractMonths: String(quote.contractMonths),
    annualMileage: String(quote.annualMileage),
  });
  if (quote.selectedOptionIds.length > 0) {
    params.set("options", quote.selectedOptionIds.join(","));
  }
  return `/quote?${params.toString()}`;
}

export function getExpiryLabel(expiresAt: Date): string {
  if (expiresAt.getTime() <= Date.now()) return "견적 만료";
  const days = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "오늘 만료";
  return `유효기간 D-${days}`;
}

export function getDeliveryLabel(quote: MyPageQuote): string {
  if (!quote.delivery) return "견적서가 필요하면 조건 확인 화면에서 카카오톡으로 전송할 수 있어요.";
  if (quote.delivery.status === "SENT") {
    return `카카오톡 전송 완료 · ${dateFormatter.format(quote.delivery.sentAt ?? quote.delivery.createdAt)}`;
  }
  if (quote.delivery.status === "FAILED") return "최근 카카오톡 전송에 실패했어요. 조건 확인 화면에서 다시 시도해 주세요.";
  return "카카오톡 전송을 준비하고 있어요.";
}

export function formatMileage(mileage: number): string {
  if (mileage > 0 && mileage % 10_000 === 0) return `${mileage / 10_000}만km`;
  return `${moneyFormatter.format(mileage)}km`;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "등록됨";
  if (digits.length === 10) return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "등록됨";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
