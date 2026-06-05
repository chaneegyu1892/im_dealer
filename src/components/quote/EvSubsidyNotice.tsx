// 전기차 보조금 안내 표기 (표시 전용).
// ⚠️ 이 값은 견적 계산(차량가)에 절대 반영되지 않는다. 실견적 입력값에 이미 반영되어 있어
//    시스템에서 별도로 차감하면 중복 차감이 된다. 오직 사용자 안내용으로만 노출한다.

interface EvSubsidyNoticeProps {
  /** 보조금 금액(원). null/0 이하이면 아무것도 렌더링하지 않는다. */
  amount: number | null | undefined;
  /** 배경 톤. onDark = 차량 상세 hero(어두운 배경), light = 견적 화면(밝은 배경). */
  tone?: "light" | "onDark";
}

export function EvSubsidyNotice({ amount, tone = "light" }: EvSubsidyNoticeProps) {
  if (!amount || amount <= 0) return null;

  const manwon = Math.round(amount / 10000).toLocaleString();

  if (tone === "onDark") {
    return (
      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-[6px] px-3 py-1.5">
        <span className="text-[10px] text-white/45 uppercase tracking-wide">전기차 보조금</span>
        <span className="text-[12px] font-semibold text-white">{manwon}만원</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-[6px] bg-primary/5 border border-primary/10 px-3 py-2 text-[12px]">
      <span className="font-medium text-primary/70">전기차 보조금</span>
      <span className="text-right leading-tight">
        <span className="font-semibold text-primary">{manwon}만원 지원 대상</span>
        <span className="block text-[10px] font-normal text-ink-caption">실구매가에 반영된 금액</span>
      </span>
    </div>
  );
}
