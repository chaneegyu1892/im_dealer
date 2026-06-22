import type { Metadata } from "next";
import { RecommendFlow } from "@/components/recommend/RecommendFlow";

export const metadata: Metadata = {
  title: "AI 추천",
  description: "업종·목적·예산·성향을 입력하면 AI가 맞는 차량을 추천해 드려요.",
};

export default function RecommendPage() {
  return (
    <div className="public-app-page min-h-screen pb-24 md:pb-0">
      <div className="border-b border-public-border bg-white">
        <div className="page-container max-w-2xl mx-auto py-3.5 md:py-8">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-public-muted">
              AI 추천
            </span>
          </div>
          <h1 className="text-[20px] font-semibold leading-tight text-ink md:font-display md:text-headline-sm md:font-light">
            내 조건에 맞는 차량 찾기
          </h1>
          <p className="mt-1 text-[12px] leading-relaxed text-public-muted md:text-[14px]">
            등록 형태와 사용 목적을 바탕으로 실제 견적 가능한 차량을 좁혀드립니다.
          </p>
        </div>
      </div>
      <RecommendFlow />
    </div>
  );
}
