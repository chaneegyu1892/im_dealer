"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Leaf, Fuel, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { formatSubsidyManwon } from "@/lib/ev-subsidy";
import { RepresentativeQuotePrice } from "@/components/cars/RepresentativeQuotePrice";

interface CarCardProps {
  vehicle: VehicleListItem;
  index?: number;
}

const ENGINE_BADGE: Record<
  EngineType,
  { label: string; icon: React.ElementType; className: string }
> = {
  EV: {
    label: "EV",
    icon: Zap,
    className: "bg-brand-soft text-brand",
  },
  하이브리드: {
    label: "HEV",
    icon: Leaf,
    className: "bg-[#E6F8EF] text-pos",
  },
  가솔린: {
    label: "가솔린",
    icon: Fuel,
    className: "bg-sec text-g1",
  },
  디젤: {
    label: "디젤",
    icon: Gauge,
    className: "bg-purple-soft text-purple",
  },
};

const BRAND_COLORS: Record<string, string> = {
  현대: "linear-gradient(145deg, #27368A 0%, #172357 60%, #5A3DB0 100%)",
  기아: "linear-gradient(145deg, #111111 0%, #2A2A2A 100%)",
  제네시스: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
};

export function CarCard({ vehicle, index = 0 }: CarCardProps) {
  const rawEngineType = vehicle.defaultTrim?.engineType ?? "가솔린";
  const engineType = (rawEngineType in ENGINE_BADGE ? rawEngineType : "가솔린") as EngineType;
  const engine = ENGINE_BADGE[engineType];
  const EngineIcon = engine.icon;
  const brandColor = BRAND_COLORS[vehicle.brand] ?? BRAND_COLORS["현대"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden rounded-[18px] border border-line2 bg-white shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lift"
    >
      <Link href={`/cars/${vehicle.slug}`} className="block">
        {/* 이미지 영역 */}
        <div className="relative aspect-[4/3] overflow-hidden bg-sec sm:aspect-[16/9]">
          {vehicle.thumbnailUrl ? (
            <Image
              src={vehicle.thumbnailUrl}
              alt={`${vehicle.brand} ${vehicle.name}`}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              unoptimized
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="relative flex h-full w-full flex-col items-center justify-center"
              style={{ background: brandColor }}
            >
              <span className="relative z-10 text-white/40 text-[11px] font-medium uppercase tracking-[0.2em] mb-1">
                {vehicle.brand}
              </span>
              <span className="relative z-10 text-white/90 text-2xl font-light tracking-tight">
                {vehicle.name}
              </span>
            </div>
          )}

          {/* 태그들 */}
          <div className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-5rem)] gap-1.5 overflow-hidden sm:left-3 sm:top-3">
            {vehicle.hasAvailableInventory && (
              <span
                className="shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-pill
                           bg-pos text-white shadow-sm"
              >
                즉시출고
              </span>
            )}
            {vehicle.highlights.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="truncate text-[11px] font-bold px-2.5 py-1 rounded-pill
                           bg-white/95 text-g1 shadow-sm backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 엔진 뱃지 */}
          <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1",
                "rounded-pill shadow-sm",
                engine.className
              )}
            >
              <EngineIcon size={10} strokeWidth={2.5} />
              {engine.label}
            </span>
          </div>
        </div>

        {/* 카드 본문 */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-bold text-g2">
              {vehicle.brand}
            </span>
            <span className="text-[12px] font-medium text-g3">{vehicle.category}</span>
          </div>

          <h3 className="mb-1.5 min-h-[44px] text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-ink transition-colors duration-200 group-hover:text-brand sm:min-h-0 sm:text-[19px]">
            {vehicle.name}
          </h3>

          {vehicle.hashtags && vehicle.hashtags.length > 0 && (
            <div className="mb-3 flex min-h-[18px] flex-wrap gap-1.5">
              {vehicle.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill bg-brand-soft px-2 py-0.5 text-[11.5px] font-bold text-brand"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {vehicle.evSubsidyRange ? (
            <div className="inline-flex items-center gap-1 mb-3 rounded-pill bg-brand-soft px-2.5 py-1">
              <Zap size={11} strokeWidth={2.5} className="text-brand" />
              <span className="text-[11px] font-bold text-brand">
                전기차 보조금 {formatSubsidyManwon(vehicle.evSubsidyRange)}
              </span>
            </div>
          ) : null}

          <div className="mb-3.5 h-px bg-line2" />

          <RepresentativeQuotePrice
            quotes={vehicle.representativeQuotes}
            tone="light"
            size="lg"
          />
        </div>
      </Link>

      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className="mx-4 mb-4 flex min-h-[46px] items-center justify-center gap-1 rounded-btn bg-brand-soft text-[13.5px] font-extrabold text-brand transition-all duration-200 hover:bg-brand hover:text-white hover:gap-2 sm:mx-5 sm:mb-5"
      >
        바로 견적 보기
        <ArrowRight size={14} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
