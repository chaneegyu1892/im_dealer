import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CarFront, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { RecommendFlow } from "@/components/recommend/RecommendFlow";

export const metadata: Metadata = {
  title: "AI 추천",
  description: "업종·목적·예산·성향을 입력하면 AI가 맞는 차량을 추천해 드려요.",
};

export default function RecommendPage() {
  return (
    <div className="home-showroom-scope min-h-screen bg-app-bg pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:pb-12">
      <section className="border-b border-border-subtle bg-surface">
        <div className="mx-auto grid w-full max-w-[1040px] gap-7 px-4 py-8 sm:px-5 md:grid-cols-[1fr_320px] md:items-end md:py-12">
          <div>
            <p className="mb-3 inline-flex rounded-pill bg-brand-soft px-3 py-1.5 text-[12px] font-extrabold text-brand">
              AI 추천으로 시작하기
            </p>
            <h1 className="break-keep text-[30px] font-extrabold leading-[1.14] tracking-[-0.04em] text-text-strong md:text-[42px]">
              용도와 예산을 고르면
              <br />
              맞는 차종만 좁혀드려요
            </h1>
            <p className="mt-3 max-w-[560px] break-keep text-[15px] font-semibold leading-[1.7] text-text-body md:text-[17px]">
              등록 형태, 주행거리, 연료 선호를 기준으로 실제 견적 가능한 차량을 먼저 추립니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-border-subtle bg-app-bg p-4 shadow-card">
            <div className="grid grid-cols-3 gap-2">
              <MiniSignal icon={<SlidersHorizontal size={17} />} label="조건" />
              <MiniSignal icon={<CarFront size={17} />} label="차량" />
              <MiniSignal icon={<ShieldCheck size={17} />} label="견적" />
            </div>
            <Link
              href="/cars"
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-[15px] bg-surface px-4 text-[13px] font-extrabold text-text-body transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
            >
              차량을 직접 둘러보기
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
      <RecommendFlow />
    </div>
  );
}

function MiniSignal({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-h-[74px] flex-col items-center justify-center rounded-[16px] border border-border-subtle bg-surface text-center text-[12px] font-extrabold text-text-body">
      <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-[11px] bg-brand-soft text-brand">
        {icon}
      </span>
      {label}
    </div>
  );
}
