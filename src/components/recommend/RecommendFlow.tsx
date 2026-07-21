"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator, STEPS, type StepId } from "./StepIndicator";
import { StepIndustry } from "./StepIndustry";
import { StepPreference } from "./StepPreference";
import { StepUsage } from "./StepUsage";
import { ChevronLeft } from "lucide-react";
import {
  INITIAL_RECOMMEND_FLOW_STATE,
  buildRecommendInput,
  isRecommendStepValid,
} from "./recommend-flow-state";
import {
  getRecommendScrollBehavior,
  useRecommendAutoScroll,
} from "./use-recommend-auto-scroll";

const TOTAL_STEPS = 3;

export function RecommendFlow() {
  const router = useRouter();
  const flowRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const requestScroll = useRecommendAutoScroll();
  const [step, setStep] = useState<StepId>(1);
  const [state, setState] = useState(INITIAL_RECOMMEND_FLOW_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = isRecommendStepValid(step, state);

  useEffect(() => {
    const behavior = getRecommendScrollBehavior();

    if (step === 1) {
      window.scrollTo({ top: 0, behavior });
      return;
    }

    flowRef.current?.scrollIntoView({ block: "start", behavior });
  }, [step]);

  const handleNext = async () => {
    if (!canProceed) return;

    if (step < TOTAL_STEPS) {
      setStep(step === 1 ? 2 : 3);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const input = buildRecommendInput(state);

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "추천 요청 실패");
      }

      const { sessionId } = (await res.json()) as { sessionId: string };
      router.push(`/recommend/result?session=${sessionId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "추천 요청 중 오류가 발생했습니다. 다시 시도해 주세요."
      );
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step === 3 ? 2 : 1);
  };

  const handleSimplePreferenceChange = (value: string) => {
    setState((s) => ({
      ...s,
      simplePreference: value,
    }));
  };

  const handleSituationPreferenceChange = (value: string) => {
    setState((s) => ({
      ...s,
      situationPreference: value,
      childDetail: value === "가족" ? s.childDetail : "",
      cargoDetail: value === "화물" ? s.cargoDetail : "",
    }));
  };

  const handleStepComplete = () => {
    requestScroll(actionRef, "nearest");
  };

  const stepLabel = (STEPS.find((s) => s.id === step) ?? STEPS[0]).label;

  return (
    <div
      ref={flowRef}
      className="t-shell scroll-mt-[72px] pt-3 pb-[120px] md:scroll-mt-[88px] md:pb-10"
    >
      {/* 앱바: 뒤로가기 + 단계명 + n/N */}
      <div className="t-appbar justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="이전 단계"
              className="t-iconbtn"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <span className="h-9 w-9" aria-hidden />
          )}
          <span className="t truncate">{stepLabel}</span>
        </div>
        <span className="num text-[15px] font-extrabold text-text-muted">
          <span className="text-brand">{step}</span>
          {" / "}
          {STEPS.length}
        </span>
      </div>

      <div className="mt-1 mb-6">
        <StepIndicator currentStep={step} />
      </div>

      <div className="min-h-[300px]">
        {step === 1 && (
          <StepIndustry
            value={state.industry}
            onChange={(industry) => setState((current) => ({ ...current, industry }))}
            budgetRange={state.budgetRange}
            onBudgetChange={(budgetRange) => setState((current) => ({ ...current, budgetRange }))}
            onComplete={handleStepComplete}
          />
        )}
        {step === 2 && (
          <StepPreference
            simpleValue={state.simplePreference}
            onSimpleChange={handleSimplePreferenceChange}
            situationValue={state.situationPreference}
            onSituationChange={handleSituationPreferenceChange}
            childDetail={state.childDetail}
            onChildDetailChange={(v) =>
              setState((s) => ({ ...s, childDetail: v }))
            }
            cargoDetail={state.cargoDetail}
            onCargoDetailChange={(v) =>
              setState((s) => ({ ...s, cargoDetail: v }))
            }
            onComplete={handleStepComplete}
          />
        )}
        {step === 3 && (
          <StepUsage
            value={state}
            onChange={(patch) => setState((current) => ({ ...current, ...patch }))}
            onComplete={handleStepComplete}
          />
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-[12px] border border-status-danger/25 bg-status-danger-soft px-4 py-3 text-[13px] font-medium text-status-danger">
          {error}
        </div>
      )}

      {/* 하단 고정 dock */}
      <div className="dock fixed inset-x-0 bottom-0 z-20 md:static md:mt-8 md:border-0 md:bg-transparent md:px-0 md:pt-0">
        <div className="t-shell px-0">
          <div className="flex items-center gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="cta cta-gho w-auto shrink-0 px-5"
              >
                이전
              </button>
            )}
            <button
              ref={actionRef}
              type="button"
              disabled={!canProceed || loading}
              onClick={handleNext}
              className="cta"
            >
              {loading
                ? "조건을 분석 중입니다"
                : step === TOTAL_STEPS
                ? "추천 결과 확인하기"
                : "다음"}
            </button>
          </div>
          <p className="mt-2.5 text-center text-[12px] text-text-muted">
            개인정보 입력 없이 추천 결과를 확인할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}
