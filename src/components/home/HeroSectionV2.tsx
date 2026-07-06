"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Search } from "lucide-react";
import type { VehicleListItem } from "@/types/api";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { isSupabaseStorageUrl } from "@/lib/image-url";

const DEFAULT_SEARCH_CHIPS = [
  { label: "SUV", query: "SUV" },
  { label: "세단", query: "세단" },
  { label: "제네시스", query: "제네시스" },
  { label: "기아", query: "기아" },
] as const;

type HeroSectionV2Props = {
  readonly featuredVehicle?: VehicleListItem;
};

export function HeroSectionV2({ featuredVehicle }: HeroSectionV2Props) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-[1120px] px-5 pb-10 pt-10 md:px-8 md:pb-16 md:pt-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-center lg:gap-16">
          {/* 좌측: 카피 + CTA + 검색 */}
          <div className="min-w-0">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[12.5px] font-bold text-brand">
              장기렌트 · 리스 견적 플랫폼
            </p>
            <h1 className="max-w-[560px] break-keep text-[34px] font-extrabold leading-[1.15] tracking-[-0.04em] text-text-strong md:text-[52px] md:leading-[1.1]">
              차를 고르기 전에
              <br />
              조건부터 분명하게
            </h1>
            <p className="mt-5 max-w-[440px] break-keep text-[15px] font-medium leading-[1.7] text-text-body md:mt-6 md:text-[17px]">
              월 납입금과 초기 비용을 먼저 확인하세요.
              <br />
              상담은 원할 때만 이어갑니다.
            </p>

            {/* 단일 메인 CTA + AI 추천 보조 */}
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Link
                href="/cars"
                className="flex h-[56px] items-center justify-center gap-2 rounded-[14px] bg-brand px-7 text-[16px] font-bold text-white shadow-[0_4px_12px_rgba(39,54,138,0.18)] transition-all hover:bg-brand-pressed active:scale-[0.99] md:text-[17px]"
              >
                차량 둘러보기
                <ArrowRight size={17} strokeWidth={2.4} />
              </Link>
              <Link
                href="/recommend"
                className="flex h-[56px] items-center justify-center gap-1.5 rounded-[14px] bg-[#F8FAFC] px-5 text-[15px] font-bold text-text-strong ring-[1.5px] ring-transparent transition-all hover:ring-[#E5E8EB] active:scale-[0.99]"
              >
                AI 추천 받기
              </Link>
            </div>

            {/* 간결 검색 */}
            <form
              action="/cars"
              method="get"
              className="mt-10 max-w-[520px]"
              aria-label="차량 검색"
            >
              <div className="flex h-[54px] items-center gap-2.5 rounded-[14px] bg-[#F8FAFC] px-4 ring-[1.5px] ring-transparent transition-all focus-within:bg-white focus-within:ring-brand">
                <Search size={18} className="shrink-0 text-text-muted" />
                <input
                  name="query"
                  type="text"
                  autoComplete="off"
                  enterKeyHint="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="차량명, 브랜드, 용도로 검색"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-text-strong outline-none placeholder:text-text-muted"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-[10px] bg-brand px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-brand-pressed"
                  aria-label="검색"
                >
                  검색
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-bold text-text-muted">인기</span>
                {DEFAULT_SEARCH_CHIPS.map((chip) => (
                  <Link
                    key={chip.query}
                    href={`/cars?query=${encodeURIComponent(chip.query)}`}
                    className="inline-flex h-8 items-center rounded-full bg-white px-3 text-[12.5px] font-bold text-text-body ring-[1px] ring-[#E5E8EB] transition-all hover:ring-brand hover:text-brand active:scale-[0.98]"
                  >
                    {chip.label}
                  </Link>
                ))}
              </div>
            </form>
          </div>

          {/* 우측: 인기 차량 1장 (데스크톱만) */}
          {featuredVehicle && (
            <FeaturedVehicleCard vehicle={featuredVehicle} />
          )}
        </div>
      </div>
    </section>
  );
}

// ─── 데스크톱 우측 인기 차량 카드 ─────────────────────────
function FeaturedVehicleCard({ vehicle }: { vehicle: VehicleListItem }) {
  return (
    <Link
      href={`/cars/${vehicle.slug}`}
      className="group hidden overflow-hidden rounded-[24px] bg-[#F8FAFC] p-5 transition-all duration-200 hover:bg-white hover:ring-[1.5px] hover:ring-brand lg:block"
    >
      {/* 인기 라벨 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-brand">
          <span className="inline-flex rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white">
            인기
          </span>
          이번 주 가장 많이 본 차량
        </span>
      </div>

      {/* 썸네일 */}
      <div className="relative mb-5 aspect-[16/10] w-full overflow-hidden rounded-[16px] bg-white">
        {vehicle.thumbnailUrl ? (
          <Image
            src={vehicle.thumbnailUrl}
            alt={vehicle.name}
            fill
            sizes="(max-width: 1024px) 100vw, 420px"
            unoptimized={isSupabaseStorageUrl(vehicle.thumbnailUrl)}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-text-muted">
            이미지 준비 중
          </div>
        )}
      </div>

      {/* 차량 정보 */}
      <p className="text-[12.5px] font-bold text-text-muted">{vehicle.brand}</p>
      <h3 className="mt-1 text-[22px] font-extrabold leading-tight text-text-strong transition-colors group-hover:text-brand">
        {vehicle.name}
      </h3>
      {vehicle.defaultTrim && (
        <p className="mt-1 text-[13.5px] text-text-body">
          {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
        </p>
      )}

      {/* 구분선 */}
      <div className="my-5 h-[1px] bg-[#E5E8EB]" />

      {/* 월 납입금 — 큰 타이포 */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <RepresentativeQuotePrice
            quotes={vehicle.representativeQuotes}
            tone="brand"
            size="xl"
            captionText="월 납입금"
            captionClassName="mb-1.5 text-[12px] font-bold leading-none text-text-muted"
            numberClassName="text-[36px]"
            unitClassName="text-[15px] font-bold"
          />
        </div>
        <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-[12px] bg-white px-4 text-[13px] font-bold text-text-body ring-[1px] ring-[#E5E8EB] transition-all group-hover:bg-brand group-hover:text-white group-hover:ring-brand">
          견적
          <ArrowRight size={13} strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
