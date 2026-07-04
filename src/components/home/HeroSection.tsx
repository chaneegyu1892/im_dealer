"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator, Search } from "lucide-react";
import { AiBadge } from "@/components/ui/AiBadge";
import type { VehicleListItem } from "@/types/api";

type HeroSectionProps = {
  readonly featuredVehicle?: VehicleListItem;
};

const DEFAULT_SEARCH_CHIPS = [
  { label: "SUV", query: "SUV" },
  { label: "세단", query: "세단" },
  { label: "제네시스", query: "제네시스" },
  { label: "기아", query: "기아" },
] as const;

export function HeroSection({ featuredVehicle }: HeroSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchChips = useMemo(() => {
    if (!featuredVehicle) return DEFAULT_SEARCH_CHIPS;

    return [
      { label: featuredVehicle.name, query: featuredVehicle.name },
      ...DEFAULT_SEARCH_CHIPS,
    ].slice(0, 5);
  }, [featuredVehicle]);

  return (
    <section className="bg-app-bg">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-8 sm:px-5 md:pb-16 md:pt-14 lg:pb-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(440px,1fr)] lg:items-center lg:gap-14">
          <div className="min-w-0 lg:pb-8">
            <p className="mb-5 inline-flex rounded-pill border border-border-subtle bg-surface px-3.5 py-2 text-[12px] font-extrabold text-text-body">
              장기렌트 · 리스 견적 플랫폼
            </p>

            <h1 className="max-w-[640px] break-keep text-[38px] font-extrabold leading-[1.04] tracking-[-0.045em] text-text-strong md:text-[58px] lg:text-[68px]">
              차를 고르기 전에
              <br />
              조건부터 분명하게.
            </h1>

            <p className="mt-5 max-w-[520px] break-keep text-[15px] font-medium leading-[1.78] text-text-body md:text-[17px]">
              <span className="block">월 납입금과 초기 비용을 먼저 확인하세요.</span>
              <span className="block">상담은 원할 때만 이어갑니다.</span>
            </p>

            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:flex sm:flex-row">
              <Link
                href="/cars"
                className="inline-flex min-h-[50px] items-center justify-center rounded-pill bg-text-strong px-3 text-[13px] font-extrabold text-surface transition-all duration-state hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 active:scale-[0.98] sm:px-6 sm:text-[14.5px]"
              >
                차량 둘러보기
              </Link>
              <Link
                href="/recommend"
                className="group inline-flex min-h-[50px] items-center justify-center gap-1.5 rounded-pill border border-border-subtle bg-surface px-2.5 text-[12.5px] font-extrabold text-text-strong shadow-card transition-all duration-state hover:border-brand/30 hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 active:scale-[0.98] sm:gap-2 sm:px-5 sm:text-[14.5px]"
              >
                AI 추천으로 시작하기
                <ArrowRight size={15} className="transition-transform duration-state group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-[calc(100%-28px)] max-w-[360px] sm:max-w-[390px] md:w-full md:max-w-[580px] lg:max-w-none">
            <div className="rounded-card-lg bg-surface p-5 shadow-card ring-1 ring-border-subtle sm:p-6 lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold text-brand">간이 차량 탐색</p>
                  <h2 className="mt-2 break-keep text-[25px] font-extrabold leading-[1.18] text-text-strong sm:text-[30px]">
                    찾고 싶은 차종을
                    <br />
                    바로 검색해보세요
                  </h2>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-brand-soft text-brand">
                  <Search size={19} strokeWidth={2.3} />
                </span>
              </div>

              <form action="/cars" method="get" className="mt-6">
                <label htmlFor="home-vehicle-search" className="mb-2 block text-[12px] font-extrabold text-text-muted">
                  차량명, 브랜드, 용도
                </label>
                <div className="flex min-h-[56px] items-center gap-2 rounded-[20px] bg-surface-soft px-4 transition-colors focus-within:bg-surface focus-within:ring-4 focus-within:ring-focus-ring/20">
                  <Search size={17} className="shrink-0 text-text-muted" />
                  <input
                    id="home-vehicle-search"
                    name="query"
                    type="text"
                    autoComplete="off"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="예: G80, 쏘렌토, SUV"
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-text-strong outline-none placeholder:text-text-muted"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {searchChips.map((chip) => (
                    <Link
                      key={chip.query}
                      href={`/cars?query=${encodeURIComponent(chip.query)}`}
                      className="inline-flex min-h-9 items-center rounded-pill bg-brand-soft px-3 text-[12px] font-extrabold text-brand transition-colors duration-state hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 active:scale-[0.98]"
                    >
                      {chip.label}
                    </Link>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="submit"
                    className="group inline-flex min-h-[50px] items-center justify-center gap-1.5 rounded-pill bg-text-strong px-5 text-[14px] font-extrabold text-surface transition-all duration-state hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 active:scale-[0.98]"
                  >
                    검색하기
                    <ArrowRight size={15} className="transition-transform duration-state group-hover:translate-x-0.5" />
                  </button>
                  <Link
                    href="/cars"
                    className="inline-flex min-h-[50px] items-center justify-center rounded-pill border border-border-subtle bg-surface px-4 text-[13px] font-extrabold text-text-strong transition-all duration-state hover:border-brand/30 hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 active:scale-[0.98]"
                  >
                    전체
                  </Link>
                </div>
              </form>

              <Link
                href="/recommend"
                className="mt-5 flex min-h-[64px] items-center justify-between gap-4 rounded-[20px] bg-surface-soft px-4 py-3 text-left transition-all duration-state hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-text-strong">
                    <AiBadge tone="soft" />
                    잘 모르겠다면 AI 추천
                  </span>
                  <span className="mt-1 block text-[12px] font-medium text-text-muted">
                    용도와 예산으로 먼저 좁히기
                  </span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-text-muted" />
              </Link>
            </div>

            <div className="mt-4 hidden grid-cols-3 divide-x divide-border-subtle overflow-hidden rounded-card-lg border border-border-subtle bg-surface sm:grid">
              {[
                ["검색", "바로 탐색"],
                ["비교", "월 납입 확인"],
                ["추천", "조건 좁히기"],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="min-h-[76px] px-3 py-4"
                >
                  <p className="text-[13px] font-extrabold text-text-strong">{title}</p>
                  <p className="mt-1 break-keep text-[11.5px] font-medium leading-snug text-text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-9 hidden gap-2 border-t border-border-subtle pt-5 lg:grid lg:grid-cols-3">
          {[
            ["상담 전 확인", "개인정보 입력 없이 주요 조건을 먼저 봅니다."],
            ["월 납입 비교", "무보증, 보증금, 선납 조건을 한 화면에서 비교합니다."],
            ["계약 전 안내", "초기 비용과 주행거리 조건을 숨기지 않습니다."],
          ].map(([title, desc]) => (
            <div key={title} className="flex items-start gap-3 px-1 py-2 sm:px-0">
              <Calculator size={16} className="mt-0.5 shrink-0 text-brand" />
              <div>
                <p className="text-[13px] font-extrabold text-text-strong">{title}</p>
                <p className="mt-1 break-keep text-[12.5px] leading-relaxed text-text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
