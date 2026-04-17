"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator, type StepId } from "./StepIndicator";
import { StepIndustry } from "./StepIndustry";
import { StepPurpose } from "./StepPurpose";
import { StepBudget, type BudgetState } from "./StepBudget";
import { StepPreference, type PreferenceState } from "./StepPreference";
import { Button } from "@/components/ui/Button";
import { ChevronLeft } from "lucide-react";
import type { RecommendInput } from "@/types/recommendation";

interface FlowState {
  industry: string;
  industryDetail: string;
  purpose: string;
  purposeDetail: string;
  budget: BudgetState;
  budgetDetail: string;
  preference: PreferenceState;
  fuelPreference: string;
}

const INITIAL_STATE: FlowState = {
  industry: "",
  industryDetail: "",
  purpose: "",
  purposeDetail: "",
  budget: {
    rangeKey: "",
    budgetMin: 0,
    budgetMax: 0,
    paymentStyle: "표준형",
  },
  budgetDetail: "",
  preference: {
    annualMileage: 0,
    returnType: "미정",
  },
  fuelPreference: "",
};

function isStepValid(step: StepId, state: FlowState): boolean {
  switch (step) {
    case 1: return state.industry !== "" && state.industryDetail !== "";
    case 2: return state.purpose !== "" && state.purposeDetail !== "";
    case 3: return state.budget.rangeKey !== "" && state.budgetDetail !== "";
    case 4: return state.preference.annualMileage !== 0 && state.fuelPreference !== "";
  }
}

export function RecommendFlow() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [state, setState] = useState<FlowState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = isStepValid(step, state);

  const handleNext = async () => {
    if (!canProceed) return;

    if (step < 4) {
      setStep((s) => (s + 1) as StepId);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const input: RecommendInput = {
        industry: state.industry,
        purpose: state.purpose,
        budgetMin: state.budget.budgetMin,
        budgetMax: state.budget.budgetMax,
        paymentStyle: state.budget.paymentStyle,
        annualMileage: state.preference.annualMileage,
        returnType: state.preference.returnType,
        industryDetail: state.industryDetail,
        purposeDetail: state.purposeDetail,
        budgetDetail: state.budgetDetail,
        fuelPreference: state.fuelPreference,
      };

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "추천 요청 실패");
      }

      const { sessionId } = await res.json() as { sessionId: string };
      router.push(`/recommend/result?session=${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "추천 요청 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as StepId);
  };

  return (
    <div className="page-container py-10 max-w-2xl mx-auto">
      <div className="flex justify-center mb-10">
        <StepIndicator currentStep={step} />
      </div>

      <div className="min-h-[360px]">
        {step === 1 && (
          <StepIndustry
            value={state.industry}
            onChange={(v) => setState((s) => ({ ...s, industry: v, industryDetail: "" }))}
            detail={state.industryDetail}
            onDetailChange={(v) => setState((s) => ({ ...s, industryDetail: v }))}
          />
        )}
        {step === 2 && (
          <StepPurpose
            value={state.purpose}
            onChange={(v) => setState((s) => ({ ...s, purpose: v, purposeDetail: "" }))}
            detail={state.purposeDetail}
            onDetailChange={(v) => setState((s) => ({ ...s, purposeDetail: v }))}
          />
        )}
        {step === 3 && (
          <StepBudget
            value={state.budget}
            onChange={(v) => setState((s) => ({ ...s, budget: v, budgetDetail: "" }))}
            detail={state.budgetDetail}
            onDetailChange={(v) => setState((s) => ({ ...s, budgetDetail: v }))}
          />
        )}
        {step === 4 && (
          <StepPreference
            value={state.preference}
            onChange={(v) => setState((s) => ({ ...s, preference: v }))}
            fuelPreference={state.fuelPreference}
            onFuelChange={(v) => setState((s) => ({ ...s, fuelPreference: v }))}
          />
        )}
      </div>

      {error && (
        <div className="mt-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[#F0F0F0]">
        {step > 1 && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleBack}
            className="flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            이전
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={!canProceed || loading}
          onClick={handleNext}
        >
          {loading
            ? "AI가 분석 중이에요..."
            : step === 4
            ? "AI 추천 결과 보기"
            : "다음"}
        </Button>
      </div>

      <p className="text-center text-caption text-ink-caption mt-3">
        {step} / 4 단계 · 개인정보 입력 없이 이용할 수 있어요
      </p>
    </div>
  );
}
