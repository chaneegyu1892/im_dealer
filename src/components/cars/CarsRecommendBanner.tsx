"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AiBadge } from "@/components/ui/AiBadge";

export function CarsRecommendBanner() {
  return (
    <section className="mt-10 overflow-hidden rounded-[28px] bg-surface p-2 shadow-float ring-1 ring-border-subtle/80 md:mt-12">
      <div className="grid gap-5 rounded-[22px] bg-surface-soft px-5 py-6 md:grid-cols-[1fr_auto] md:items-center md:px-8 md:py-7">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <AiBadge tone="soft" />
            <span className="text-[12px] font-extrabold text-brand">
              맞춤 추천
            </span>
          </div>
          <h3 className="mb-1.5 break-keep text-[22px] font-extrabold tracking-[-0.02em] text-text-strong md:text-[26px]">
            어떤 차가 맞는지 모르겠다면?
          </h3>
          <p className="break-keep text-[14px] leading-relaxed text-text-muted">
            업종·예산·성향 4가지 질문으로 최적의 차량을 찾아드려요.
          </p>
        </div>
        <Link
          href="/recommend"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand px-6 text-[14px] font-extrabold text-white shadow-[0_10px_22px_rgba(var(--color-brand-rgb),0.22)] transition-all duration-state hover:bg-brand-pressed active:scale-[0.98] md:w-auto"
        >
          AI 추천 시작
          <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}
