import { Fragment, useId, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import {
  computeReferralFunnel,
  REFERRAL_STEP_LABELS,
  type ReferralProgressItem,
} from "@/lib/referral/progress";

interface Badge {
  label: string;
  className: string;
}

function badgeOf(item: ReferralProgressItem): Badge {
  if (item.step === 4) {
    return { label: "계약 완료", className: "bg-status-positive-soft text-status-positive" };
  }
  if (item.isLost) {
    return { label: "진행 중단", className: "bg-surface-soft text-text-muted" };
  }
  if (item.step === 3) {
    return { label: "상담 중", className: "bg-brand-soft text-brand" };
  }
  if (item.step === 2) {
    return { label: "견적 완료", className: "bg-brand-soft text-brand" };
  }
  return { label: "가입 완료", className: "bg-surface-soft text-text-muted" };
}

function Stepper({ item }: { item: ReferralProgressItem }) {
  return (
    <div className="mt-4 flex" aria-label={`진행 단계: ${item.step} / 4`}>
      {REFERRAL_STEP_LABELS.map((label, i) => {
        const stepNo = i + 1;
        const reached = stepNo <= item.step;
        const lineFilled = (n: number) => n <= item.step;
        const lineClass = (filled: boolean) =>
          filled
            ? item.isLost
              ? "bg-border-strong"
              : "bg-brand"
            : "bg-border-subtle";
        return (
          <div key={label} className="relative flex flex-1 flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute left-0 top-[13px] h-[2px] w-1/2 ${lineClass(lineFilled(stepNo))}`}
              />
            )}
            {i < REFERRAL_STEP_LABELS.length - 1 && (
              <span
                aria-hidden
                className={`absolute right-0 top-[13px] h-[2px] w-1/2 ${lineClass(lineFilled(stepNo + 1))}`}
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full ${
                reached
                  ? item.isLost
                    ? "bg-text-muted text-white"
                    : "bg-brand text-white"
                  : "border-2 border-border-subtle bg-surface"
              }`}
            >
              {reached && <Check size={14} strokeWidth={3} />}
            </span>
            <span
              className={`mt-1.5 text-[11px] ${
                reached && !item.isLost
                  ? "font-bold text-text-strong"
                  : "font-semibold text-text-muted"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ReferralProgress({ items }: { items: ReferralProgressItem[] }) {
  const [listOpen, setListOpen] = useState(true);
  const listPanelId = useId();

  if (items.length === 0) return null;

  const funnel = computeReferralFunnel(items);
  const funnelValues = [funnel.signup, funnel.quote, funnel.consult, funnel.contract];

  return (
    <section className="mb-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[16px] font-extrabold text-text-strong">추천 전환 현황</h2>
        <p className="text-[11px] font-semibold text-text-muted">누적 기준</p>
      </div>

      <div className="mb-3 flex items-stretch rounded-card border border-border-subtle bg-surface-soft p-2">
        {REFERRAL_STEP_LABELS.map((label, i) => {
          const isContract = i === REFERRAL_STEP_LABELS.length - 1;
          return (
            <Fragment key={label}>
              {i > 0 && (
                <span className="flex items-center text-border-strong" aria-hidden>
                  <ChevronRight size={14} />
                </span>
              )}
              <div className="flex-1 py-2 text-center">
                <div
                  className={
                    isContract
                      ? "-my-1 inline-block rounded-[10px] bg-status-positive-soft px-5 py-1"
                      : ""
                  }
                >
                  <p
                    className={`text-[11px] font-bold ${
                      isContract ? "text-status-positive" : "text-text-muted"
                    }`}
                  >
                    {label}
                  </p>
                  <p
                    className={`mt-0.5 text-[20px] font-extrabold tabular-nums ${
                      isContract ? "text-status-positive" : "text-text-strong"
                    }`}
                  >
                    {funnelValues[i]}
                  </p>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={listOpen}
          aria-controls={listPanelId}
          onClick={() => setListOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 rounded-btn px-1 py-2 text-left transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
        >
          <span className="flex items-center gap-1.5 text-[14px] font-extrabold text-text-strong">
            추천 목록
            <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-brand">
              {items.length}
            </span>
          </span>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-soft transition-transform duration-200 ${
              listOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            <ChevronDown size={18} strokeWidth={2.5} className="text-text-body" />
          </span>
        </button>
        <div
          id={listPanelId}
          className={`grid transition-all duration-200 ${
            listOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <ul className="space-y-3 pt-1">
              {items.map((item) => {
                const badge = badgeOf(item);
                const converted = item.step === 4;
                return (
                  <li
                    key={item.id}
                    className={`rounded-card border bg-surface p-4 shadow-card ${
                      converted ? "border-status-positive/50" : "border-border-subtle"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-extrabold text-text-strong">
                        {item.maskedName}
                      </p>
                      <span
                        className={`rounded-pill px-2.5 py-1 text-[11px] font-extrabold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] font-semibold text-text-muted">
                      {item.signedUpLabel} 가입
                    </p>
                    <Stepper item={item} />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
