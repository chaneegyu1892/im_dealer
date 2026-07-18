import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Info,
  UserRound,
} from "lucide-react";
import {
  BUDGET_RANGE_OPTIONS,
  INDUSTRY_OPTIONS,
} from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepIndustryProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly budgetMax: number | null;
  readonly onBudgetChange: (value: number) => void;
}

const INDUSTRY_ICONS = {
  개인: <UserRound size={18} aria-hidden />,
  법인: <Building2 size={18} aria-hidden />,
  개인사업자: <BriefcaseBusiness size={18} aria-hidden />,
} satisfies Record<(typeof INDUSTRY_OPTIONS)[number]["value"], ReactNode>;

export function StepIndustry({
  value,
  onChange,
  budgetMax,
  onBudgetChange,
}: StepIndustryProps) {
  return (
    <div className="space-y-3">
      <div className="mb-6">
        <span className="t-kick">STEP 01</span>
        <h2 className="t-h1 mt-2">
          어떤 형태로 <span className="text-brand">차량을 등록</span>하실 건가요?
        </h2>
        <p className="t-sub mt-2">
          개인, 법인, 개인사업자 중 하나를 먼저 골라주세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INDUSTRY_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            desc={option.desc}
            icon={INDUSTRY_ICONS[option.value]}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>

      {value !== "" && (
        <section
          aria-labelledby="monthlyBudgetTitle"
          className="t-gray mt-6 animate-slide-down p-4"
        >
          <div className="mb-4">
            <span className="t-kick text-[11px]">공통 추가 질문</span>
            <h3
              id="monthlyBudgetTitle"
              className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-[-0.03em] text-text-strong"
            >
              월 납입금 예산은 어느 정도인가요?
            </h3>
            <div className="mt-3 flex gap-2 rounded-[14px] border border-brand/15 bg-brand-soft p-3.5 text-brand">
              <Info size={17} className="mt-0.5 shrink-0" aria-hidden />
              <p className="break-keep text-[12.5px] font-bold leading-relaxed">
                모든 금액은 60개월 · 연 2만km · 무보증 기준입니다.
                <span className="block font-medium text-brand/75">
                  보증금과 선납금 없이 시작하는 월 납입금이에요.
                </span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BUDGET_RANGE_OPTIONS.map((option) => (
              <SelectionCard
                key={option.budgetMax}
                label={option.label}
                desc={option.desc}
                icon={<CircleDollarSign size={18} aria-hidden />}
                selected={budgetMax === option.budgetMax}
                onClick={() => onBudgetChange(option.budgetMax)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
