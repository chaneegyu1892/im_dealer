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
    className: "bg-primary-100 text-primary border-primary-200",
  },
  하이브리드: {
    label: "HEV",
    icon: Leaf,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  가솔린: {
    label: "가솔린",
    icon: Fuel,
    className: "bg-neutral text-ink-label border-neutral-800",
  },
  디젤: {
    label: "디젤",
    icon: Gauge,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const BRAND_COLORS: Record<string, string> = {
  현대: "linear-gradient(145deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
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
      className="group relative overflow-hidden rounded-[18px] border border-public-border bg-white shadow-mobile-card transition-shadow duration-200 hover:border-primary-200 hover:shadow-card-hover"
    >
      <Link href={`/cars/${vehicle.slug}`} className="block">
        {/* 이미지 영역 */}
        <div className="relative aspect-[4/3] overflow-hidden bg-public-bg sm:aspect-[16/9]">
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
                className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-[4px]
                           bg-primary text-white backdrop-blur-sm"
              >
                즉시출고
              </span>
            )}
            {vehicle.highlights.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="truncate text-[10px] font-semibold px-2 py-0.5 rounded-[4px]
                           bg-white/90 text-ink backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 엔진 뱃지 */}
          <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5",
                "rounded-[4px] border backdrop-blur-sm bg-white/90",
                engine.className
              )}
            >
              <EngineIcon size={9} strokeWidth={2.5} />
              {engine.label}
            </span>
          </div>
        </div>

        {/* 카드 본문 */}
        <div className="p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-public-muted uppercase tracking-[0.12em]">
              {vehicle.brand}
            </span>
            <span className="text-[11px] text-public-muted">{vehicle.category}</span>
          </div>

          <h3 className="mb-1.5 min-h-[42px] text-[17px] font-semibold leading-tight text-ink transition-colors duration-200 group-hover:text-primary sm:min-h-0">
            {vehicle.name}
          </h3>

          <p className="mb-3 min-h-[18px] truncate text-[12px] leading-relaxed text-ink-label">
            {vehicle.description}
          </p>

          {vehicle.evSubsidyRange ? (
            <div className="inline-flex items-center gap-1 mb-3 rounded-[5px] bg-primary/[0.06] border border-primary/10 px-2 py-1">
              <Zap size={11} strokeWidth={2.5} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary">
                전기차 보조금 {formatSubsidyManwon(vehicle.evSubsidyRange)}
              </span>
            </div>
          ) : null}

          <div className="mb-3 h-px bg-public-border" />

          <RepresentativeQuotePrice
            quotes={vehicle.representativeQuotes}
            tone="light"
            size="md"
          />
        </div>
      </Link>

      <Link
        href={`/quote?vehicle=${vehicle.slug}`}
        className="mx-3.5 mb-3.5 flex min-h-[38px] items-center justify-center gap-1 rounded-[10px] bg-primary/[0.06] text-[12px] font-semibold text-primary transition-all duration-200 hover:bg-primary/10 hover:gap-2 sm:mx-4 sm:mb-4"
      >
        바로 견적 보기
        <ArrowRight size={13} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
