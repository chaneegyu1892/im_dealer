"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { RecommendResultResponse } from "@/types/recommendation";
import { RecommendVehicleCard } from "./RecommendVehicleCard";
import { RecommendCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TrustBadgeGroup } from "@/components/ui/TrustBadge";
import { RotateCcw, Sparkles } from "lucide-react";

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
  const sessionId = params.get("session");

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
      <div className="page-container max-w-3xl mx-auto py-4 md:py-8 space-y-5">
        <div className="public-mobile-section flex items-center gap-3 p-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary animate-pulse">
            <Sparkles size={14} className="text-white" />
          </span>
          <p className="text-[13px] font-medium text-ink-label">조건에 맞는 차량을 분석 중입니다</p>
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
      <div className="page-container max-w-3xl mx-auto py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={24} className="text-primary" />
        </div>
        <h2 className="text-[18px] font-semibold text-ink">추천 결과를 불러올 수 없어요</h2>
        <p className="mt-2 text-[13px] text-public-muted">
          잠시 후 다시 시도해 주세요.
        </p>
        <Button
          variant="primary"
          size="md"
          className="mt-6 min-h-[48px] rounded-[12px] font-semibold"
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
      <div className="page-container max-w-3xl mx-auto py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={24} className="text-primary" />
        </div>
        <h2 className="text-[18px] font-semibold text-ink">추천 결과가 없어요</h2>
        <p className="mt-2 text-[13px] text-public-muted">
          조건을 조금 바꿔보면 더 많은 차량을 찾을 수 있어요.
        </p>
        <Button
          variant="primary"
          size="md"
          className="mt-6 min-h-[48px] rounded-[12px] font-semibold"
          onClick={() => router.push("/recommend")}
        >
          <RotateCcw size={14} className="mr-2" />
          조건 다시 설정하기
        </Button>
      </div>
    );
  }

  const { input, vehicles } = result;

  // ── 결과 ──────────────────────────────────────────────
  return (
    <div className="page-container max-w-3xl mx-auto py-4 md:py-8">
      {/* 입력 요약 */}
      <div className="public-mobile-section mb-4 p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary" />
              <p className="text-[12px] font-semibold text-primary">추천 완료</p>
            </div>
            <h2 className="text-[19px] font-semibold leading-tight text-ink">
              {vehicles.length}개 차량을 추천합니다
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-primary/[0.06] px-3 py-1.5 text-[12px] font-semibold text-primary">
            조건 기반
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            LABEL_MAP[input.industry] ?? input.industry,
            LABEL_MAP[input.purpose] ?? input.purpose,
            input.annualMileage ? `연 ${(input.annualMileage / 10000).toFixed(0)}만km` : "",
            input.fuelPreference,
          ].filter(Boolean).map((label) => (
            <span
              key={label}
              className="rounded-full border border-public-border bg-public-bg px-2.5 py-1 text-[11px] font-medium text-public-muted"
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
      <div className="mt-4 text-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push("/recommend")}
          className="min-h-[42px] rounded-[12px] border-public-border bg-white px-4 text-ink-label"
        >
          <RotateCcw size={13} className="mr-1.5" />
          조건 바꿔서 다시 추천받기
        </Button>
      </div>
    </div>
  );
}
