import type { Metadata } from "next";
import { RecommendFlow } from "@/components/recommend/RecommendFlow";
import { createPageMetadata } from "@/lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI 맞춤 차량 추천",
  description:
    "업종·이용 목적·예산·주행거리와 연료 선호를 입력하면 장기렌트·리스 견적이 가능한 차량을 추천해 드려요.",
  path: "/recommend",
});

export default function RecommendPage() {
  return (
    <div className="min-h-screen bg-white pb-[calc(160px+env(safe-area-inset-bottom,0px))] md:pb-12">
      <section className="border-b border-[#E5E8EB] bg-white">
        <div className="mx-auto w-full max-w-[680px] px-5 py-8 max-[340px]:px-4 md:max-w-[1040px] md:px-8 md:py-12">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-brand-soft px-3 py-1.5 text-[12.5px] font-bold text-brand">
              AI 추천으로 시작하기
            </p>
            <h1 className="break-keep text-[28px] font-extrabold leading-[1.15] tracking-[-0.04em] text-text-strong max-[340px]:text-[26px] md:text-[42px]">
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
