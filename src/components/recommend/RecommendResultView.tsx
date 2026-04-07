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

    fetch(`/api/recommend/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<RecommendResultResponse>;
      })
      .then(setResult)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  // ── 로딩 ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-container py-8 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2 mb-6">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary animate-pulse">
            <Sparkles size={14} className="text-white" />
          </span>
          <p className="text-[14px] text-ink-label">AI가 조건에 맞는 차량을 분석 중이에요…</p>
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
      <div className="page-container py-16 max-w-3xl mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={24} className="text-primary" />
        </div>
        <h2 className="text-title-sm text-ink font-medium">추천 결과를 불러올 수 없어요</h2>
        <p className="text-label text-ink-label mt-2">
          잠시 후 다시 시도해 주세요.
        </p>
        <Button
          variant="primary"
          size="md"
          className="mt-6"
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
      <div className="page-container py-16 max-w-3xl mx-auto text-center">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={24} className="text-primary" />
        </div>
        <h2 className="text-title-sm text-ink font-medium">추천 결과가 없어요</h2>
        <p className="text-label text-ink-label mt-2">
          조건을 조금 바꿔보면 더 많은 차량을 찾을 수 있어요.
        </p>
        <Button
          variant="primary"
          size="md"
          className="mt-6"
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
    <div className="page-container py-8 max-w-3xl mx-auto">
      {/* 입력 요약 */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={15} className="text-primary" />
          <p className="text-[13px] font-medium text-primary">AI 추천 완료</p>
        </div>
        <h2 className="text-title-sm text-ink font-medium">
          {vehicles.length}개 차량을 추천해 드려요
        </h2>
        <p className="text-label text-ink-label mt-1">
          {LABEL_MAP[input.industry] ?? input.industry} ·{" "}
          {LABEL_MAP[input.purpose] ?? input.purpose} ·{" "}
          월 {(input.budgetMax / 10000).toFixed(0)}만원 이하
        </p>
      </div>

      {/* 신뢰 배지 */}
      <TrustBadgeGroup className="mb-6" />

      {/* 차량 카드 목록 */}
      <div className="grid grid-cols-1 gap-6">
        {vehicles.map((v, i) => (
          <RecommendVehicleCard key={v.vehicleId} vehicle={v} isTop={i === 0} />
        ))}
      </div>

      {/* 하단 재시도 */}
      <div className="mt-8 text-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push("/recommend")}
        >
          <RotateCcw size={13} className="mr-1.5" />
          조건 바꿔서 다시 추천받기
        </Button>
      </div>
    </div>
  );
}
