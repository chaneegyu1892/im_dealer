"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator, STEPS, type StepId } from "./StepIndicator";
import { StepIndustry } from "./StepIndustry";
import { StepPurpose } from "./StepPurpose";
import { StepMileage } from "./StepMileage";
import { StepFuelPreference } from "./StepFuelPreference";
import { StepRegion } from "./StepRegion";
import { ChevronLeft } from "lucide-react";
import { CHARGING_OPTIONS } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";
import type { RecommendInput } from "@/types/recommendation";

const TOTAL_STEPS = 3;

type ChargingEnv = "자택" | "직장" | "외부" | "없음" | "";

interface FlowState {
  industry: string;
  industryDetail: string;
  purpose: string;
  purposeDetail: string;
  annualMileage: number;
  fuelPreference: string;
  chargingEnvironment: ChargingEnv;
  residenceRegion: "일반" | "강원·산간" | "제주";
}

const INITIAL_STATE: FlowState = {
  industry: "",
  industryDetail: "",
  purpose: "",
  purposeDetail: "",
  annualMileage: 0,
  fuelPreference: "",
  chargingEnvironment: "",
  residenceRegion: "일반",
};

function isStepValid(step: StepId, state: FlowState): boolean {
  switch (step) {
    case 1:
      return state.industry !== "" && state.industryDetail !== "";
    case 2:
      return state.purpose !== "" && state.purposeDetail !== "";
    case 3:
      return (
        state.annualMileage !== 0 &&
        state.fuelPreference !== "" &&
        (state.fuelPreference !== "전기차" || state.chargingEnvironment !== "")
      );
  }
}

export function RecommendFlow() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [state, setState] = useState<FlowState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = isStepValid(step, state);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const handleNext = async () => {
    if (!canProceed) return;

    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as StepId);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const input: RecommendInput = {
        industry: state.industry,
        purpose: state.purpose,
        annualMileage: state.annualMileage,
        returnType: "미정",
        industryDetail: state.industryDetail,
        purposeDetail: state.purposeDetail,
        fuelPreference: state.fuelPreference,
        ...(state.fuelPreference === "전기차" && state.chargingEnvironment !== ""
          ? { chargingEnvironment: state.chargingEnvironment }
          : {}),
        residenceRegion: state.residenceRegion,
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
    if (step > 1) setStep((s) => (s - 1) as StepId);
  };

  const handleFuelChange = (v: string) => {
    setState((s) => ({
      ...s,
      fuelPreference: v,
      // 전기차에서 다른 연료로 바꾸면 충전 환경 초기화
      chargingEnvironment: v === "전기차" ? s.chargingEnvironment : "",
    }));
  };

  const stepLabel = (STEPS.find((s) => s.id === step) ?? STEPS[0]).label;

  return (
    <div className="t-shell pt-3 pb-[120px] md:pb-10">
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
        <span className="num text-[15px] font-extrabold text-g2">
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
            onChange={(v) =>
              setState((s) => ({ ...s, industry: v, industryDetail: "" }))
            }
            detail={state.industryDetail}
            onDetailChange={(v) =>
              setState((s) => ({ ...s, industryDetail: v }))
            }
          />
        )}
        {step === 2 && (
          <StepPurpose
            industry={state.industry}
            value={state.purpose}
            onChange={(v) =>
              setState((s) => ({ ...s, purpose: v, purposeDetail: "" }))
            }
            detail={state.purposeDetail}
            onDetailChange={(v) =>
              setState((s) => ({ ...s, purposeDetail: v }))
            }
          />
        )}
        {step === 3 && (
          <div className="space-y-8">
            <StepMileage
              value={state.annualMileage}
              onChange={(v) =>
                setState((s) => ({ ...s, annualMileage: v }))
              }
            />
            <div className="border-t border-line pt-7">
              <StepFuelPreference
                value={state.fuelPreference}
                onChange={handleFuelChange}
              />
              {state.fuelPreference === "전기차" && (
                <div className="mt-5 rounded-[16px] border border-brand/15 bg-brand-soft p-4 transition-all duration-200">
                  <h3 className="text-[15px] font-extrabold text-ink">
                    충전 환경이 있나요?
                  </h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-g2">
                    집·회사·아파트 등 일상 충전이 가능한지에 따라 추천이
                    달라져요.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
                    {CHARGING_OPTIONS.map((opt) => (
                      <SelectionCard
                        key={opt.value}
                        selected={state.chargingEnvironment === opt.value}
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            chargingEnvironment: opt.value as ChargingEnv,
                          }))
                        }
                        icon={opt.icon}
                        label={opt.label}
                        desc={opt.desc}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-line pt-7">
              <StepRegion
                value={state.residenceRegion}
                onChange={(v) => setState((s) => ({ ...s, residenceRegion: v }))}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">
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
              type="button"
              disabled={!canProceed || loading}
              onClick={handleNext}
              className="cta"
            >
              {loading
                ? "조건을 분석 중입니다"
                : step === TOTAL_STEPS
                ? "추천 결과 확인하기"
                : "다음 →"}
            </button>
          </div>
          <p className="mt-2.5 text-center text-[12px] text-g2">
            개인정보 입력 없이 추천 결과를 확인할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}
