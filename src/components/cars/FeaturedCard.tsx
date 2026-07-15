"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { isSupabaseStorageUrl } from "@/lib/image-url";
import { hasRepresentativeQuote } from "@/lib/representative-quote";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";

interface FeaturedCardProps {
  vehicle: VehicleListItem;
  size?: "large" | "small";
}

export function FeaturedCard({ vehicle, size = "large" }: FeaturedCardProps) {
  const specs = vehicle.defaultTrim?.specs ?? {};
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
            "relative grid h-full grid-cols-[38%_1fr] items-center gap-4 lg:grid-cols-[48%_1fr] lg:gap-3",
            size === "large"
              ? "min-h-[218px] p-4 md:min-h-[230px] md:p-5"
              : "min-h-[204px] p-4 md:min-h-[218px] md:p-5",
          )}
        >
          <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-card transition-transform duration-state group-hover:-translate-y-0.5">
            {vehicle.thumbnailUrl ? (
              <Image
                src={vehicle.thumbnailUrl}
                alt={vehicle.name}
                fill
                sizes="(max-width: 767px) 38vw, 180px"
                unoptimized={isSupabaseStorageUrl(vehicle.thumbnailUrl)}
                className="!relative !inset-auto !h-auto !w-full max-h-full max-w-full rounded-card object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] font-bold text-text-muted">
                이미지 준비 중
              </div>
            )}
          </div>

          <div className="flex min-h-[172px] min-w-0 flex-col pb-12 md:min-h-[188px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="shrink-0 whitespace-nowrap rounded-pill bg-surface-soft px-2.5 py-1 text-[10px] font-bold text-text-body">
                {vehicle.brand}
              </span>
              {vehicle.isPopular && (
                <span className="rounded-pill bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand">
                  인기
                </span>
              )}
              {vehicle.hasAvailableInventory && (
                <span className="rounded-pill bg-status-positive-soft px-2.5 py-1 text-[10px] font-bold text-status-positive">
                  즉시출고
                </span>
              )}
            </div>

            <h2
              className={cn(
                "mt-3 line-clamp-2 font-extrabold leading-tight tracking-[-0.03em] text-text-strong",
                size === "large" ? "text-[21px] md:text-[25px]" : "text-[19px] md:text-[22px]",
              )}
            >
              {vehicle.name}
            </h2>

            {vehicle.hashtags && vehicle.hashtags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {vehicle.hashtags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="max-w-full truncate rounded-pill bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {size === "large" && Object.entries(specs).length > 0 && (
              <div className="mt-3 hidden grid-cols-2 gap-1.5 md:grid">
                {Object.entries(specs)
                  .slice(0, 2)
                  .map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-btn bg-surface-soft px-2.5 py-2">
                      <div className="text-[9px] font-bold text-text-muted">{label}</div>
                      <div className="truncate text-[11px] font-extrabold text-text-strong">{value}</div>
                    </div>
                  ))}
              </div>
            )}

            <div className="mt-auto pt-3">
              <RepresentativeQuotePrice
                quotes={vehicle.representativeQuotes}
                tone="brand"
                size={size === "large" ? "lg" : "sm"}
                showCaption={false}
                numberClassName="text-[23px] md:text-[27px]"
                unitClassName="text-[12px] font-bold"
              />
              <p className="mt-0.5 text-[9.5px] font-medium leading-tight text-text-muted">
                월 납입금 · 60개월 · 연 2만km · 무보증
              </p>
            </div>
          </div>
        </div>
      </Link>
      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className={cn(
          "absolute bottom-4 right-4 z-20 flex min-h-[42px] items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-[13px] font-extrabold text-white transition-all duration-state hover:bg-brand-pressed active:translate-y-0 active:scale-[0.98] group-hover:-translate-y-0.5 group-hover:gap-2.5 md:bottom-5 md:right-5 md:min-h-[46px] md:px-5 md:text-[13.5px]",
        )}
      >
        {hasQuote ? "견적 보기" : "견적 내기"}
        <ArrowRight size={13} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
