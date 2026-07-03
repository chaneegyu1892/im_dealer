"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import type { VehicleListItem } from "@/types/api";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";

const INITIAL_VISIBLE = 3;

function PopularCard({ vehicle, index }: { vehicle: VehicleListItem; index: number }) {
  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link
        href={`/cars/${vehicle.slug}`}
        className="group relative block rounded-[26px] bg-surface p-3 ring-1 ring-border-subtle transition-all duration-state hover:-translate-y-0.5 hover:ring-brand/30 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        <div className="relative grid grid-cols-[112px_minmax(0,1fr)] gap-3.5 min-[375px]:grid-cols-[120px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)] md:block">
          <div className="relative h-[96px] w-full overflow-hidden rounded-[20px] bg-surface-soft shadow-[inset_0_0_0_1px_rgba(var(--color-text-strong-rgb),0.05)] sm:h-[116px] md:h-[168px] md:rounded-[22px] lg:h-[176px]">
            {vehicle.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vehicle.thumbnailUrl}
                alt={vehicle.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-text-muted">
                이미지 준비 중
              </div>
            )}
            <div className="absolute left-2 top-2 flex items-center gap-1">
              {vehicle.isPopular && (
                <span className="inline-flex rounded-pill bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white">
                  인기
                </span>
              )}
              {vehicle.hasAvailableInventory && (
                <span className="hidden rounded-pill bg-status-positive px-2 py-0.5 text-[10px] font-extrabold text-white sm:inline-flex">
                  즉시출고
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 py-1 md:px-1 md:pt-4">
            <p className="truncate text-[12px] font-extrabold text-text-muted">
              {vehicle.brand}
            </p>
            <h3 className="mt-1 line-clamp-2 text-[16px] font-extrabold leading-tight text-text-strong transition-colors duration-state group-hover:text-brand sm:text-[18px] md:text-[19px]">
              {vehicle.name}
            </h3>
            {vehicle.defaultTrim && (
              <p className="mt-1.5 truncate text-[12.5px] font-medium text-text-muted">
                {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
              </p>
            )}

            <div className="mt-3 flex items-end justify-between gap-2 border-t border-border-subtle pt-3 md:mt-4 md:gap-3">
              <RepresentativeQuotePrice
                quotes={vehicle.representativeQuotes}
                tone="brand"
                size="lg"
                captionText="월 납입금"
                captionClassName="mb-1.5 text-[12px] font-bold leading-none"
                numberClassName="text-[30px] sm:text-[32px] md:text-[34px]"
                unitClassName="text-[13px] font-bold sm:text-[14px]"
              />
              <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-pill bg-surface-soft px-2.5 text-[11px] font-extrabold text-text-body transition-colors duration-state group-hover:bg-brand group-hover:text-white md:px-3 md:text-[11.5px]">
                비교
                <ArrowRight size={12} strokeWidth={2.5} />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PopularCarsSection({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = vehicles.length > INITIAL_VISIBLE;
  const visibleVehicles = expanded ? vehicles : vehicles.slice(0, INITIAL_VISIBLE);

  return (
    <section className="bg-app-bg px-5 pb-12 pt-0 sm:px-6 md:pb-14">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="mb-7 flex flex-col items-start justify-between gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-end md:mb-6">
          <div>
            <div className="mb-2 text-[12px] font-extrabold text-text-muted">
              지금 보는 차량
            </div>
            <h2 className="break-keep text-[27px] font-extrabold leading-[1.18] tracking-[-0.03em] text-text-strong md:text-[36px]">
              많이 찾는 차종부터
              <br />
              부담 없이 비교해보세요
            </h2>
          </div>
          <Link
            href="/cars"
            className="hidden min-h-11 shrink-0 items-center gap-1 rounded-pill bg-surface px-4 text-[13px] font-extrabold text-text-body ring-1 ring-border-subtle transition-all duration-state hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 sm:flex"
          >
            전체 보기 <ArrowRight size={13} />
          </Link>
        </div>

        <div className="mx-auto grid w-full max-w-[360px] grid-cols-1 gap-4 md:max-w-none md:grid-cols-2 lg:grid-cols-3">
          {visibleVehicles.map((v, i) => (
            <PopularCard key={v.id} vehicle={v} index={i} />
          ))}
        </div>

        {hasMore && (
          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-surface px-6 text-[13.5px] font-bold text-text-body shadow-card transition-all duration-state hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  접기
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  더 많은 인기 차량 보기 ({vehicles.length - INITIAL_VISIBLE}개 더)
                  <ChevronDown size={14} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
