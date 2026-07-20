import type { Metadata } from "next";
import { RecommendFlow } from "@/components/recommend/RecommendFlow";

export const metadata: Metadata = {
  title: "AI 추천",
  description: "업종·목적·예산·성향을 입력하면 AI가 맞는 차량을 추천해 드려요.",
};

export default function RecommendPage() {
  return (
    <div className="min-h-screen bg-white pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:pb-12">
      <section className="border-b border-[#E5E8EB] bg-white">
        <div className="mx-auto w-full max-w-[680px] px-5 py-8 md:max-w-[1040px] md:px-8 md:py-12">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-brand-soft px-3 py-1.5 text-[12.5px] font-bold text-brand">
              AI 추천으로 시작하기
            </p>
            <h1 className="break-keep text-[28px] font-extrabold leading-[1.15] tracking-[-0.04em] text-text-strong md:text-[42px]">
              용도와 예산을 고르면
              <br />
              맞는 차종만 좁혀드려요
            </h1>
            <p className="mt-3 max-w-[560px] break-keep text-[14px] font-medium leading-[1.7] text-text-body md:text-[17px]">
              등록 형태, 주행거리, 연료 선호를 기준으로 실제 견적 가능한 차량을 먼저 추려요.
            </p>
          </div>
        </div>
      </section>
      <RecommendFlow />
    </div>
  );
}
