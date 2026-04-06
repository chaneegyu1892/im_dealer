import type { Metadata } from "next";
import { RecommendFlow } from "@/components/recommend/RecommendFlow";

export const metadata: Metadata = {
  title: "AI 추천",
  description: "업종·목적·예산·성향을 입력하면 AI가 맞는 차량을 추천해 드려요.",
};

export default function RecommendPage() {
  return (
    <div>
      <div className="bg-white border-b border-[#F0F0F0] py-6">
        <div className="page-container max-w-xl mx-auto">
          <h1 className="text-title-sm text-ink font-medium">AI 차량 추천</h1>
          <p className="text-label text-ink-label mt-1">
            4가지 질문으로 딱 맞는 차량과 견적을 찾아드려요.
          </p>
        </div>
      </div>
      <RecommendFlow />
    </div>
  );
}
