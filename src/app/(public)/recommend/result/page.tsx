import type { Metadata } from "next";
import { Suspense } from "react";
import { RecommendResultView } from "@/components/recommend/RecommendResultView";
import { RecommendCardSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "AI 추천 결과",
  description: "AI가 분석한 맞춤 차량 추천 결과를 확인해 보세요.",
};

export default function RecommendResultPage() {
  return (
    <div className="public-app-page min-h-screen pb-24 md:pb-0">
      <div className="border-b border-public-border bg-white">
        <div className="page-container max-w-3xl mx-auto py-3.5 md:py-6">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-public-muted">
              AI 추천
            </span>
          </div>
          <h1 className="text-[20px] font-semibold leading-tight text-ink md:text-title-sm">
            추천 결과
          </h1>
          <p className="mt-1 text-[12px] leading-relaxed text-public-muted md:text-label">
            입력하신 조건에 맞는 차량과 월 납입금을 정리했습니다.
          </p>
        </div>
      </div>

      {/* useSearchParams는 Suspense 경계 안에서만 */}
      <Suspense
        fallback={
          <div className="page-container py-8 max-w-xl mx-auto space-y-5">
            {[1, 2, 3].map((i) => (
              <RecommendCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <RecommendResultView />
      </Suspense>
    </div>
  );
}
