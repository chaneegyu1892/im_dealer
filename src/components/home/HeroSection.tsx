"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Calculator, CarFront, ClipboardCheck } from "lucide-react";
import type { VehicleListItem } from "@/types/api";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";

type HeroSectionProps = {
  readonly featuredVehicle?: VehicleListItem;
};

const SHOWROOM_LINKS = [
  { href: "/cars", label: "빠른 출고", desc: "재고 있는 모델부터", icon: BadgeCheck },
  { href: "/cars", label: "인기 차량", desc: "많이 비교한 차종", icon: CarFront },
  { href: "/recommend", label: "AI 추천", desc: "용도에 맞게 좁히기", icon: ClipboardCheck },
] as const;

export function HeroSection({ featuredVehicle }: HeroSectionProps) {
  const heroImage = featuredVehicle?.thumbnailUrl;

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
              <span className="block">월 납입금과 초기비용을 먼저 확인하세요.</span>
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
            <div className="overflow-hidden rounded-[34px] bg-surface ring-1 ring-border-subtle">
              <div className="relative aspect-[255/100] bg-surface-soft sm:aspect-[255/100] md:aspect-[1.7] lg:aspect-[1.34]">
                {heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroImage}
                    alt={featuredVehicle.name}
                    className="h-full w-full object-contain p-3 sm:p-4 lg:p-2"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-text-muted">
                    대표 차량 준비중
                  </div>
                )}
              </div>
              {featuredVehicle && (
                <div className="border-t border-border-subtle bg-surface px-4 py-3.5 sm:px-6 sm:py-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(178px,auto)] items-start gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="text-[13px] font-extrabold text-text-muted">{featuredVehicle.brand}</p>
                      <h2 className="mt-1 truncate text-[19px] font-extrabold text-text-strong sm:text-[20px]">
                        {featuredVehicle.name}
                      </h2>
                    </div>
                    <RepresentativeQuotePrice
                      quotes={featuredVehicle.representativeQuotes}
                      tone="brand"
                      size="md"
                      captionText="월 납입금 · 60개월 · 초기비용 0원"
                      captionClassName="mb-1 whitespace-nowrap text-right text-[10.5px] font-semibold leading-tight sm:text-[13px]"
                      numberClassName="text-[30px]"
                      unitClassName="text-[14px] font-semibold sm:text-[15px]"
                      className="ml-auto shrink-0 text-right"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 hidden divide-y divide-border-subtle rounded-[24px] border border-border-subtle bg-surface lg:grid lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              {SHOWROOM_LINKS.map(({ href, label, desc, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="group flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors duration-state hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30 md:block md:min-h-[104px] md:px-4 md:py-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-soft text-text-body transition-colors duration-state group-hover:bg-brand-soft group-hover:text-brand md:mb-4">
                    <Icon size={16} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-extrabold text-text-strong">{label}</span>
                    <span className="mt-1 block text-[11.5px] font-medium leading-snug text-text-muted">{desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-9 hidden gap-2 border-t border-border-subtle pt-5 lg:grid lg:grid-cols-3">
          {[
            ["상담 전 확인", "개인정보 입력 없이 주요 조건을 먼저 봅니다."],
            ["월 납입 비교", "무보증, 보증금, 선납 조건을 한 화면에서 비교합니다."],
            ["계약 전 안내", "초기비용과 주행거리 조건을 숨기지 않습니다."],
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
