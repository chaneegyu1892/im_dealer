"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator, type StepId } from "./StepIndicator";
import { StepIndustry } from "./StepIndustry";
import { StepPurpose } from "./StepPurpose";
import { StepMileage } from "./StepMileage";
import { StepFuelPreference } from "./StepFuelPreference";
import { StepRegion } from "./StepRegion";
import { Button } from "@/components/ui/Button";
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

  return (
    <div className="page-container max-w-2xl mx-auto py-4 md:py-8">
      <div className="mb-5">
        <StepIndicator currentStep={step} />
      </div>

      <div className="public-mobile-section min-h-[360px] p-4 md:p-6">
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
            <div className="pt-6 border-t border-public-border">
              <StepFuelPreference
                value={state.fuelPreference}
                onChange={handleFuelChange}
              />
              {state.fuelPreference === "전기차" && (
                <div className="mt-5 rounded-[16px] border border-primary/15 bg-primary/[0.04] p-4 transition-all duration-200">
                  <h3 className="text-[16px] font-semibold text-ink">
                    충전 환경이 있나요?
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-public-muted">
                    집·회사·아파트 등 일상 충전이 가능한지에 따라 추천이
                    달라져요.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
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
            <div className="pt-6 border-t border-public-border">
              <StepRegion
                value={state.residenceRegion}
                onChange={(v) => setState((s) => ({ ...s, residenceRegion: v }))}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {step > 1 && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleBack}
            className="min-h-[48px] shrink-0 rounded-[12px] border-public-border bg-white px-4 text-ink-label"
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
          className="min-h-[48px] rounded-[12px] font-semibold"
        >
          {loading
            ? "조건을 분석 중입니다"
            : step === TOTAL_STEPS
            ? "추천 결과 확인하기"
            : "다음"}
        </Button>
      </div>

      <p className="mt-3 text-center text-[12px] text-public-muted">
        개인정보 입력 없이 추천 결과를 확인할 수 있습니다
      </p>
    </div>
  );
}
