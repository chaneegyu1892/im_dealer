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
    <div>
      <div className="bg-white border-b border-[#F0F0F0] py-6">
        <div className="page-container max-w-xl mx-auto">
          <h1 className="text-title-sm text-ink font-medium">AI 추천 결과</h1>
          <p className="text-label text-ink-label mt-1">
            입력하신 조건에 맞는 차량과 견적을 분석했어요.
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
