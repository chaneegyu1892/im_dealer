import { CheckCircle2, Clock, AlertCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AdminQuoteAlimtalk,
  AdminQuoteDelivery,
  AdminQuoteDeliveryStatus,
} from "@/types/admin";

const DELIVERY_STYLE: Record<
  AdminQuoteDeliveryStatus,
  { label: string; bg: string; text: string; icon: typeof Clock }
> = {
  SENT: { label: "전달됨", bg: "bg-[#E8F8EF]", text: "text-[#1FC26B]", icon: CheckCircle2 },
  PENDING: { label: "전달중", bg: "bg-[#E5E5FA]", text: "text-[#6066EE]", icon: Clock },
  FAILED: { label: "실패", bg: "bg-[#FFECEF]", text: "text-[#E23B4A]", icon: AlertCircle },
  NONE: { label: "이력없음", bg: "bg-[#E8EAF2]", text: "text-[#5A5D80]", icon: Minus },
};

export function QuoteDeliveryStatusBadge({
  status,
}: {
  status: AdminQuoteDeliveryStatus;
}) {
  const style = DELIVERY_STYLE[status];
  const Icon = style.icon;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
        style.bg,
        style.text
      )}
    >
      <Icon size={11} strokeWidth={2.5} /> {style.label}
    </div>
  );
}

function alimtalkReason(alimtalk: AdminQuoteAlimtalk): string {
  if (alimtalk.failReason) return alimtalk.failReason;
  if (alimtalk.resultCode) return `결과코드 ${alimtalk.resultCode}`;
  return "알 수 없음";
}

export function QuoteDeliveryDetail({
  delivery,
  alimtalk,
}: {
  delivery: AdminQuoteDelivery;
  alimtalk: AdminQuoteAlimtalk | null;
}) {
  return (
    <section>
      <h4 className="text-[13px] font-bold text-[#1A1A2E] mb-3 flex items-center gap-1.5">
        전달 상태
      </h4>
      <div className="bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6B7399]">견적서 전달</span>
          <QuoteDeliveryStatusBadge status={delivery.status} />
        </div>
        {delivery.status === "NONE" ? (
          <p className="text-[12px] text-[#6B7399]">전달 이력이 없습니다.</p>
        ) : (
          <>
            {delivery.failReason && (
              <div>
                <p className="text-[10px] text-[#6B7399] mb-0.5">전달 실패 사유</p>
                <p className="text-[12px] font-medium text-[#1A1A2E]">{delivery.failReason}</p>
              </div>
            )}
            {delivery.createdAt && (
              <div>
                <p className="text-[10px] text-[#6B7399] mb-0.5">전달 요청</p>
                <p className="text-[12px] font-medium text-[#1A1A2E]">
                  {new Date(delivery.createdAt).toLocaleString("ko-KR")}
                </p>
              </div>
            )}
          </>
        )}
        {alimtalk && (
          <div className="pt-2 border-t border-[#E8EAF0] space-y-1.5">
            <p className="text-[10px] text-[#6B7399]">최근 알림톡</p>
            <p className="text-[12px] font-medium text-[#1A1A2E] font-mono">
              {alimtalk.templateKey}
            </p>
            <p className="text-[12px] text-[#4A5270]">{alimtalk.status}</p>
            {alimtalk.status === "FAILED" && (
              <p className="text-[12px] font-medium text-[#1A1A2E]">{alimtalkReason(alimtalk)}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
