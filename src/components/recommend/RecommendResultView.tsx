"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { RecommendResultResponse } from "@/types/recommendation";
import { RecommendVehicleCard } from "./RecommendVehicleCard";
import { RecommendCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TrustBadgeGroup } from "@/components/ui/TrustBadge";
import { RotateCcw, Lightbulb } from "lucide-react";
import { AiBadge } from "@/components/ui/AiBadge";
import { STEP02_V3_STYLE_LABELS } from "@/constants/recommend-step02-v3";
import { RECOMMEND_BUDGET_RANGE_LABELS } from "@/constants/recommend-budget";

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

export function RecommendResultView() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params?.get("session") ?? null;

  const [result, setResult] = useState<RecommendResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      .then((data) => { if (!cancelled) setResult(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sessionId, router]);

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
    return (
      <div className="mx-auto w-full max-w-[480px] px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-4">
          <Lightbulb size={24} className="text-brand" />
        </div>
        <h2 className="text-[18px] font-semibold text-text-strong">추천 결과가 없어요</h2>
        <p className="mt-2 text-[13px] text-text-muted">
          조건을 조금 바꿔보면 더 많은 차량을 찾을 수 있어요.
        </p>
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

      {/* 하단 재시도 */}
      <button
        type="button"
        onClick={() => router.push("/recommend")}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-btn bg-surface-soft py-[14px] text-[14px] font-bold text-text-body transition-colors hover:bg-brand-soft hover:text-brand"
      >
        <RotateCcw size={14} />
        조건 바꿔서 다시 추천받기
      </button>
    </div>
  );
}
