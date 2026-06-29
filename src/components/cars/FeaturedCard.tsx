"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";
import { summarizeVehicleDescription } from "@/lib/public-ui-text";

interface FeaturedCardProps {
  vehicle: VehicleListItem;
  size?: "large" | "small";
  index?: number;
}

/**
 * 차량 탐색 "주목할 차량" 카드 — 다크 배경 + 호버 시 이미지 줌·CTA 강조.
 * 단독(large/small) 및 슬라이더(FeaturedCarsSlider) 양쪽에서 사용.
 */
export function FeaturedCard({ vehicle, size = "large", index = 0 }: FeaturedCardProps) {
  const specs = vehicle.defaultTrim?.specs ?? {};
  const description = summarizeVehicleDescription(vehicle.description);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative h-full cursor-pointer overflow-hidden rounded-[20px] bg-neutral-900 shadow-[0_16px_36px_rgba(18,24,40,0.14)] transition-shadow duration-200 hover:shadow-[0_20px_46px_rgba(18,24,40,0.18)]"
    >
      <Link href={`/cars/${vehicle.slug}`} className="block h-full">
        {vehicle.thumbnailUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 group-hover:scale-110 transition-transform duration-700"
            style={{ backgroundImage: `url(${vehicle.thumbnailUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-black/68" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />
        <div
          className={cn(
            "relative z-10 flex h-full flex-col justify-between",
            size === "large"
              ? "p-5 md:p-10 min-h-[220px] md:min-h-[340px]"
              : "p-5 md:p-8 min-h-[220px] md:min-h-[340px]",
          )}
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] font-bold bg-white/15 text-white/95 px-3 py-1 rounded-pill backdrop-blur-sm">
                {vehicle.brand}
              </span>
              {vehicle.isPopular && (
                <span className="inline-flex items-center gap-1 text-[12px] font-bold bg-brand text-white px-3 py-1 rounded-pill">
                  인기
                </span>
              )}
              {vehicle.hasAvailableInventory && (
                <span className="text-[12px] font-bold bg-pos text-white px-3 py-1 rounded-pill">
                  즉시출고
                </span>
              )}
            </div>
            <h2
              className={cn(
                "font-extrabold text-white leading-tight mb-2 tracking-[-0.03em] drop-shadow-sm",
                size === "large"
                  ? "text-[24px] md:text-[40px]"
                  : "text-[22px] md:text-[30px]",
              )}
            >
              {vehicle.name}
            </h2>
            {description && (
              <p className="max-w-sm text-[13px] leading-relaxed text-white/80 drop-shadow-sm md:text-[14px]">
                {description}
              </p>
            )}
          </div>
          <div>
            {size === "large" && Object.entries(specs).length > 0 && (
              <div className="hidden md:flex gap-5 mb-6">
                {Object.entries(specs)
                  .slice(0, 3)
                  .map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[10px] text-white/35 mb-0.5">{label}</div>
                      <div className="text-[13px] font-medium text-white/85">{value}</div>
                    </div>
                  ))}
              </div>
            )}
            <RepresentativeQuotePrice
              quotes={vehicle.representativeQuotes}
              tone="dark"
              size={size === "large" ? "xl" : "lg"}
            />
          </div>
        </div>
      </Link>
      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className={cn(
          "absolute z-20 flex min-h-[42px] items-center gap-1.5 rounded-btn bg-white text-[13px] font-extrabold text-brand transition-all duration-200 group-hover:gap-2.5 group-hover:shadow-lg md:min-h-[46px] md:px-5 md:text-[13.5px]",
          "px-4 py-2",
          size === "large"
            ? "bottom-5 right-5 md:bottom-10 md:right-10"
            : "bottom-5 right-5 md:bottom-8 md:right-8",
        )}
      >
        견적 보기
        <ArrowRight size={13} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
