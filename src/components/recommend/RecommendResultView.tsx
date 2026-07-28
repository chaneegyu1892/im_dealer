"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import type { RecommendResultResponse } from "@/types/recommendation";
import { RecommendVehicleCard } from "./RecommendVehicleCard";
import { RecommendCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TrustBadgeGroup } from "@/components/ui/TrustBadge";
import { CarFront, CircleDollarSign, RotateCcw, Lightbulb } from "lucide-react";
import { AiBadge } from "@/components/ui/AiBadge";
import {
  STEP02_V3_STYLE_LABELS,
  isStep02V3Style,
} from "@/constants/recommend-step02-v3";
import {
  RECOMMEND_BUDGET_RANGE_LABELS,
  RECOMMEND_BUDGET_RANGE_OPTIONS,
  type RecommendBudgetRange,
} from "@/constants/recommend-budget";
import { SelectionCard } from "./SelectionCard";

const LABEL_MAP: Record<string, string> = {
  법인: "법인",
  개인사업자: "개인사업자",
  직장인: "직장인",
  개인: "개인",
  출퇴근: "출퇴근",
  "영업·외근": "영업·외근",
  가족: "가족용",
  "화물·배달": "화물·배달",
  "의전·임원용": "의전·임원용",
  첫차: "첫차",
  "레저·캠핑": "레저·캠핑",
};

function buildBudgetRetryInput(
  input: RecommendResultResponse["input"],
  budgetRange: RecommendBudgetRange
) {
  if (
    typeof input.stylePreference !== "string"
    || !isStep02V3Style(input.stylePreference)
  ) return null;

  const situationPreference = input.situationPreference === "가족"
    || input.situationPreference === "화물"
    ? input.situationPreference
    : undefined;

  return {
    recommendationVersion: "step02-v3" as const,
    industry: input.industry,
    budgetRange,
    preferences: [input.stylePreference, situationPreference].filter(
      (value): value is NonNullable<typeof value> => value !== undefined
    ),
    stylePreference: input.stylePreference,
    annualMileage: input.annualMileage,
    returnType: input.returnType,
    fuelPreference: input.fuelPreference ?? "상관없음",
    residenceRegion: input.residenceRegion ?? "일반",
    ...(input.industryDetail ? { industryDetail: input.industryDetail } : {}),
    ...(situationPreference ? { situationPreference } : {}),
    ...(situationPreference === "가족" && input.childDetail
      ? { childDetail: input.childDetail }
      : {}),
    ...(situationPreference === "화물" && input.cargoDetail
      ? { cargoDetail: input.cargoDetail }
      : {}),
    ...(input.fuelPreference === "전기차" && input.chargingEnvironment
      ? { chargingEnvironment: input.chargingEnvironment }
      : {}),
  };
}

export function RecommendResultView() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params?.get("session") ?? null;

  const [result, setResult] = useState<RecommendResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryBudgetRange, setRetryBudgetRange] = useState<RecommendBudgetRange | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/recommend");
      return;
    }

    let cancelled = false;
    fetch(`/api/recommend/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<RecommendResultResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          setRetryBudgetRange(data.input.budgetRange ?? null);
          setRetryError(null);
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sessionId, router]);

  const handleBudgetRetry = async () => {
    if (!result || !retryBudgetRange) return;

    const retryInput = buildBudgetRetryInput(result.input, retryBudgetRange);
    if (!retryInput) {
      setRetryError("기존 추천 조건을 불러오지 못했습니다. 처음부터 다시 선택해 주세요.");
      return;
    }

    setRetrying(true);
    setRetryError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryInput),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        sessionId?: string;
      };

      if (!response.ok || !payload.sessionId) {
        throw new Error(payload.error ?? "추천 요청 실패");
      }

      setLoading(true);
      router.push(`/recommend/result?session=${payload.sessionId}`);
    } catch (retryRequestError) {
      setRetryError(
        retryRequestError instanceof Error
          ? retryRequestError.message
          : "추천 요청 중 오류가 발생했습니다. 다시 시도해 주세요."
      );
    } finally {
      setRetrying(false);
    }
  };

  // ── 로딩 ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-5 md:max-w-[760px] md:px-6 md:py-9 space-y-4">
        <div className="flex items-center gap-3 rounded-[16px] border border-border-subtle bg-surface p-4 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand animate-pulse">
            <Lightbulb size={15} className="text-white" />
          </span>
          <p className="text-[13px] font-bold text-text-body">조건에 맞는 차량을 분석 중입니다</p>
        </div>
        {[1, 2, 3].map((i) => (
          <RecommendCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // ── 에러 ──────────────────────────────────────────────
  if (error || !result) {
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-4">
          <Lightbulb size={24} className="text-brand" />
        </div>
        <h2 className="text-[18px] font-semibold text-text-strong">추천 결과를 불러올 수 없어요</h2>
        <p className="mt-2 text-[13px] text-text-muted">
          잠시 후 다시 시도해 주세요.
        </p>
        <Button
          variant="primary"
          size="md"
          className="mt-6 min-h-[48px] rounded-btn font-extrabold"
          onClick={() => router.push("/recommend")}
        >
          <RotateCcw size={14} className="mr-2" />
          다시 추천받기
        </Button>
      </div>
    );
  }

  // ── 결과 없음 ──────────────────────────────────────────
  if (result.vehicles.length === 0) {
    const canRetryBudget = typeof result.input.stylePreference === "string"
      && isStep02V3Style(result.input.stylePreference)
      && result.input.budgetRange !== undefined;

    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-10 md:max-w-[640px] md:px-6 md:py-14">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
          <Lightbulb size={24} className="text-brand" />
        </div>
        <div className="text-center">
          <h2 className="text-[20px] font-extrabold text-text-strong">추천 결과가 없어요</h2>
          <p className="mt-2 break-keep text-[14px] leading-relaxed text-text-muted">
            예산 범위를 조정하면 더 많은 차량을 찾을 수 있어요.
          </p>
        </div>

        {canRetryBudget ? (
          <section
            aria-labelledby="retryBudgetTitle"
            className="mt-6 rounded-card border border-border-subtle bg-surface p-4 shadow-card md:p-5"
          >
            <div className="mb-4">
              <span className="text-[12px] font-extrabold text-brand">예산만 다시 선택</span>
              <h3
                id="retryBudgetTitle"
                className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-[-0.03em] text-text-strong"
              >
                월 납입금 예산을 바꿔볼까요?
              </h3>
              <p className="mt-1.5 break-keep text-[13px] leading-relaxed text-text-muted">
                앞에서 선택한 다른 답변은 그대로 유지됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {RECOMMEND_BUDGET_RANGE_OPTIONS.map((option) => (
                <SelectionCard
                  key={option.id}
                  label={option.label}
                  desc={option.desc}
                  icon={<CircleDollarSign size={18} aria-hidden />}
                  selected={retryBudgetRange === option.id}
                  onClick={() => setRetryBudgetRange(option.id)}
                />
              ))}
            </div>

            {retryError && (
              <p
                role="alert"
                className="mt-4 rounded-[12px] border border-status-danger/25 bg-status-danger-soft px-3.5 py-3 text-[13px] font-medium text-status-danger"
              >
                {retryError}
              </p>
            )}

            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={retrying}
              disabled={
                !retryBudgetRange
                || retryBudgetRange === result.input.budgetRange
              }
              className="mt-5 min-h-[48px] rounded-btn font-extrabold"
              onClick={handleBudgetRetry}
            >
              {retrying ? "새 예산으로 분석 중입니다" : "예산 바꿔 다시 추천받기"}
            </Button>
          </section>
        ) : (
          <div className="text-center">
            <Button
              variant="primary"
              size="md"
              className="mt-6 min-h-[48px] rounded-btn font-extrabold"
              onClick={() => router.push("/recommend")}
            >
              <RotateCcw size={14} className="mr-2" />
              조건 다시 설정하기
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { input, vehicles } = result;

  const budgetLabel = input.budgetRange
    ? RECOMMEND_BUDGET_RANGE_LABELS[input.budgetRange]
    : input.budgetMax && input.budgetMax > 0
      ? `월 ${Math.round(input.budgetMax / 10_000)}만원 이하`
      : "월 예산 미정";

  const summaryTags = [
    LABEL_MAP[input.industry] ?? input.industry,
    input.stylePreference
      ? STEP02_V3_STYLE_LABELS[input.stylePreference]
      : LABEL_MAP[input.purpose] ?? input.purpose,
    budgetLabel,
    "월 납입금 60개월·2만km·무보증",
    input.annualMileage ? `연간 주행 ${(input.annualMileage / 10000).toFixed(0)}만km` : "",
    input.fuelPreference,
  ].filter(Boolean);

  // ── 결과 ──────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-5 md:max-w-[760px] md:px-6 md:py-9">
      {/* 헤더: kicker + 큰 헤드라인 */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5">
          <AiBadge tone="soft" />
          <span className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-brand">
            추천 결과
          </span>
        </div>
        <h1 className="mt-2.5 text-[28px] font-extrabold leading-[1.25] tracking-[-0.04em] text-text-strong md:text-[34px]">
          조건에 맞는 추천 차량 <span className="num text-brand">{vehicles.length}대</span>
        </h1>
        {/* 입력 요약 태그 */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          {summaryTags.map((label) => (
            <span
              key={label}
              className="rounded-pill bg-brand-soft px-[13px] py-[7px] text-[13px] font-bold text-brand"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 신뢰 배지 */}
      <TrustBadgeGroup className="mb-4" />

      {/* 차량 카드 목록 */}
      <div className="grid grid-cols-1 gap-4">
        {vehicles.map((v, i) => (
          <RecommendVehicleCard
            key={v.vehicleId}
            vehicle={v}
            isTop={i === 0}
            industry={input.industry}
          />
        ))}
      </div>

      {/* 3순위 추천 뒤 차량 탐색 CTA */}
      <section className="mt-5 rounded-card border border-border-subtle bg-surface-soft px-4 py-5 text-center">
        <p className="text-[15px] font-extrabold text-text-strong">
          원하시는 차량이 안나왔나요?
        </p>
        <Link
          href="/cars"
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-btn bg-brand px-5 text-[14px] font-extrabold text-white transition-all duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-soft active:scale-[0.98]"
        >
          <CarFront size={16} />
          차량 탐색하기
        </Link>
      </section>
    </div>
  );
}
