"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import { hasRepresentativeQuote } from "@/lib/representative-quote";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { summarizeVehicleDescription } from "@/lib/public-ui-text";

interface FeaturedCardProps {
  vehicle: VehicleListItem;
  size?: "large" | "small";
}

/**
 * 차량 탐색 "주목할 차량" 카드 — 가격과 CTA를 먼저 읽히게 하는 앱형 카드.
 * 단독(large/small) 및 슬라이더(FeaturedCarsSlider) 양쪽에서 사용.
 */
export function FeaturedCard({ vehicle, size = "large" }: FeaturedCardProps) {
  const specs = vehicle.defaultTrim?.specs ?? {};
  const description = summarizeVehicleDescription(vehicle.description);
  const hasQuote = hasRepresentativeQuote(vehicle.representativeQuotes);

  return (
    <motion.div
      initial={false}
      className={cn(
        "group relative h-full cursor-pointer overflow-hidden rounded-[28px] bg-surface transition-all duration-state",
        "hover:-translate-y-1 hover:scale-[1.012] hover:bg-surface-raised",
      )}
    >
      <Link href={`/cars/${vehicle.slug}`} className="block h-full">
        <div
          className={cn(
            "relative flex h-full flex-col",
            size === "large"
              ? "min-h-[260px] p-5 md:min-h-[320px] md:p-7"
              : "min-h-[230px] p-5 md:min-h-[280px] md:p-6",
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="shrink-0 whitespace-nowrap rounded-pill bg-surface-soft px-3 py-1 text-[12px] font-bold text-text-body">
                  {vehicle.brand}
                </span>
                {vehicle.isPopular && (
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill bg-brand-soft px-3 py-1 text-[12px] font-bold text-brand">
                    인기
                  </span>
                )}
                {vehicle.hasAvailableInventory && (
                  <span className="shrink-0 whitespace-nowrap rounded-pill bg-status-positive-soft px-3 py-1 text-[12px] font-bold text-status-positive">
                    즉시출고
                  </span>
                )}
              </div>
              <h2
                className={cn(
                  "font-extrabold leading-tight tracking-[-0.03em] text-text-strong",
                  size === "large"
                    ? "text-[25px] md:text-[34px]"
                    : "text-[22px] md:text-[28px]",
                )}
              >
                {vehicle.name}
              </h2>
              {description && (
                <p className="mt-2 line-clamp-2 max-w-sm text-[13px] leading-relaxed text-text-muted md:text-[14px]">
                  {description}
                </p>
              )}
            </div>

            <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-[20px] bg-surface-soft transition-transform duration-state group-hover:-translate-y-0.5 group-hover:scale-[1.02] md:h-24 md:w-32">
              {vehicle.thumbnailUrl ? (
                <Image
                  src={vehicle.thumbnailUrl}
                  alt={vehicle.name}
                  fill
                  sizes="160px"
                  unoptimized
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : null}
            </div>
          </div>

          {size === "large" && Object.entries(specs).length > 0 && (
            <div className="mb-5 hidden gap-2 md:grid md:grid-cols-3">
              {Object.entries(specs)
                .slice(0, 3)
                .map(([label, value]) => (
                  <div key={label} className="rounded-[14px] bg-surface-soft px-3 py-2.5">
                    <div className="mb-0.5 text-[10px] font-bold text-text-muted">{label}</div>
                    <div className="truncate text-[13px] font-extrabold text-text-strong">{value}</div>
                  </div>
                ))}
              </div>
          )}

          <div className="mt-auto rounded-[20px] bg-surface-soft/75 px-4 py-3.5 transition-colors duration-state group-hover:bg-surface-raised">
            <RepresentativeQuotePrice
              quotes={vehicle.representativeQuotes}
              tone="brand"
              size={size === "large" ? "xl" : "lg"}
            />
          </div>
        </div>
      </Link>
      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className={cn(
          "absolute z-20 flex min-h-[42px] items-center gap-1.5 rounded-pill bg-brand text-[13px] font-extrabold text-white transition-all duration-state group-hover:gap-2.5 group-hover:-translate-y-0.5 md:min-h-[46px] md:px-5 md:text-[13.5px]",
          "hover:bg-brand-pressed active:translate-y-0 active:scale-[0.98]",
          "px-4 py-2",
          size === "large"
            ? "bottom-5 right-5 md:bottom-10 md:right-10"
            : "bottom-5 right-5 md:bottom-8 md:right-8",
        )}
      >
        {hasQuote ? "견적 보기" : "견적 내기"}
        <ArrowRight size={13} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
